"""
S3 HTML to FAISS Ingestion Endpoints

This router provides endpoints to ingest HTML content from S3 into FAISS vector database.
"""
import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import boto3
from botocore.exceptions import ClientError
from bs4 import BeautifulSoup
import numpy as np
import faiss
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/faiss", tags=["FAISS Ingestion"])


# ==========================================
# Request/Response Models
# ==========================================

class S3HTMLIngestRequest(BaseModel):
    """S3 HTML取り込みリクエスト"""
    s3_bucket: str = Field(..., description="S3バケット名")
    s3_keys: List[str] = Field(..., description="取り込むHTMLファイルのS3キーリスト")
    course_id: Optional[int] = Field(None, description="関連するコースID")
    course_name: Optional[str] = Field(None, description="関連するコース名")
    module_name: Optional[str] = Field(None, description="モジュール名")
    chunk_size: int = Field(1000, description="テキストのチャンクサイズ", ge=100, le=5000)
    chunk_overlap: int = Field(200, description="チャンクのオーバーラップサイズ", ge=0, le=1000)


class S3PrefixIngestRequest(BaseModel):
    """S3プレフィックス一括取り込みリクエスト"""
    s3_bucket: str = Field(..., description="S3バケット名")
    s3_prefix: str = Field(..., description="HTMLファイルが格納されているS3プレフィックス")
    course_id: Optional[int] = Field(None, description="関連するコースID")
    course_name: Optional[str] = Field(None, description="関連するコース名")
    module_name: Optional[str] = Field(None, description="モジュール名")
    chunk_size: int = Field(1000, description="テキストのチャンクサイズ", ge=100, le=5000)
    chunk_overlap: int = Field(200, description="チャンクのオーバーラップサイズ", ge=0, le=1000)
    recursive: bool = Field(True, description="サブフォルダも再帰的に検索")


class S3TodayIngestRequest(BaseModel):
    """当日追加されたHTMLファイルを取り込むリクエスト"""
    s3_bucket: str = Field(..., description="S3バケット名")
    s3_prefix: str = Field(..., description="HTMLファイルが格納されているS3プレフィックス")
    chunk_size: int = Field(1000, description="テキストのチャンクサイズ", ge=100, le=5000)
    chunk_overlap: int = Field(200, description="チャンクのオーバーラップサイズ", ge=0, le=1000)


class S3AllIngestRequest(BaseModel):
    """全HTMLファイルを取り込むリクエスト"""
    s3_bucket: str = Field(..., description="S3バケット名")
    s3_prefix: str = Field(..., description="HTMLファイルが格納されているS3プレフィックス")
    chunk_size: int = Field(1000, description="テキストのチャンクサイズ", ge=100, le=5000)
    chunk_overlap: int = Field(200, description="チャンクのオーバーラップサイズ", ge=0, le=1000)


class IngestResponse(BaseModel):
    """取り込みレスポンス"""
    success: bool = Field(..., description="処理成功フラグ")
    message: str = Field(..., description="処理結果メッセージ")
    files_processed: int = Field(..., description="処理したファイル数")
    documents_added: int = Field(..., description="追加したドキュメント数")
    faiss_total_vectors: int = Field(..., description="FAISSインデックスの総ベクトル数")
    errors: Optional[List[str]] = Field(None, description="エラーメッセージリスト")


class FAISSStatsResponse(BaseModel):
    """FAISS統計情報レスポンス"""
    total_documents: int = Field(..., description="総ドキュメント数")
    total_vectors: int = Field(..., description="総ベクトル数")
    dimension: int = Field(..., description="ベクトルの次元数")
    embedding_model: str = Field(..., description="使用している埋め込みモデル")
    s3_bucket: str = Field(..., description="S3バケット名")
    s3_prefix: str = Field(..., description="S3プレフィックス")


# ==========================================
# Text Processing Utilities
# ==========================================

class TextProcessor:
    """テキスト処理ユーティリティ"""

    @staticmethod
    def clean_html(html_content: str) -> str:
        """HTMLからテキストを抽出"""
        try:
            soup = BeautifulSoup(html_content, 'lxml')

            # スクリプトとスタイルを削除
            for element in soup(['script', 'style', 'nav', 'footer', 'header']):
                element.decompose()

            text = soup.get_text(separator='\n', strip=True)

            # 連続する空白行を削除
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n'.join(lines)
        except Exception as e:
            logger.error(f"Failed to clean HTML: {e}")
            return ""

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """テキストをチャンクに分割"""
        if not text or len(text) <= chunk_size:
            return [text] if text else []

        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # チャンクの境界を文の終わりに調整
            if end < len(text):
                # 次の句点、改行、またはスペースを探す
                for delimiter in ['\n\n', '\n', '. ', '。', '! ', '!', '? ', '?']:
                    pos = text.rfind(delimiter, start, end)
                    if pos != -1:
                        end = pos + len(delimiter)
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap

        return chunks


# ==========================================
# FAISS Manager
# ==========================================

class FAISSManager:
    """FAISS + S3マネージャー"""

    def __init__(self):
        self.s3_bucket = os.getenv('S3_BUCKET_NAME')
        self.s3_prefix = os.getenv('FAISS_S3_PREFIX', 'vector_db/')
        self.aws_region = os.getenv('AWS_REGION', 'ap-northeast-1')
        self.embedding_model_name = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
        self.local_cache_dir = os.getenv('FAISS_CACHE_DIR', '/tmp/faiss_cache')

        if not self.s3_bucket:
            raise ValueError("S3_BUCKET_NAME environment variable is required")

        # S3クライアント
        self.s3_client = boto3.client('s3', region_name=self.aws_region)

        # 埋め込みモデル（遅延ロード）
        self.embedder = None
        self.dimension = None

        # FAISSインデックスとメタデータをロード
        self.index = None
        self.documents = []
        self.metadatas = []
        self._load_from_s3()

    def _ensure_embedder_loaded(self):
        """埋め込みモデルの遅延ロード"""
        if self.embedder is None:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model: {self.embedding_model_name}")
            self.embedder = SentenceTransformer(self.embedding_model_name)
            self.dimension = self.embedder.get_sentence_embedding_dimension()
            logger.info(f"Embedding model loaded. Dimension: {self.dimension}")

    def _load_from_s3(self):
        """S3からFAISSインデックスとメタデータをロード"""
        cache_dir = Path(self.local_cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)

        index_key = f"{self.s3_prefix}faiss_index.bin"
        metadata_key = f"{self.s3_prefix}metadata.json"

        index_path = cache_dir / "faiss_index.bin"
        metadata_path = cache_dir / "metadata.json"

        try:
            # FAISSインデックスをダウンロード
            logger.info(f"Downloading FAISS index from s3://{self.s3_bucket}/{index_key}")
            self.s3_client.download_file(self.s3_bucket, index_key, str(index_path))

            # メタデータをダウンロード
            logger.info(f"Downloading metadata from s3://{self.s3_bucket}/{metadata_key}")
            self.s3_client.download_file(self.s3_bucket, metadata_key, str(metadata_path))

            # FAISSインデックスをロード
            self.index = faiss.read_index(str(index_path))
            logger.info(f"FAISS index loaded: {self.index.ntotal} vectors")

            # メタデータをロード
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                self.documents = metadata.get('documents', [])
                self.metadatas = metadata.get('metadatas', [])

            logger.info(f"Loaded {len(self.documents)} documents from S3")

        except ClientError as e:
            if e.response['Error']['Code'] == '404' or e.response['Error']['Code'] == 'NoSuchKey':
                logger.warning("FAISS index not found in S3. Empty index will be created on first use.")
                # 空のインデックスは最初の追加時に作成
                self.index = None
                self.documents = []
                self.metadatas = []
            else:
                raise

    def add_documents(self, documents: List[str], metadatas: List[Dict[str, Any]]) -> None:
        """ドキュメントをFAISSインデックスに追加"""
        if not documents:
            return

        logger.info(f"Adding {len(documents)} documents to FAISS index...")

        try:
            # 埋め込みモデルをロード
            self._ensure_embedder_loaded()

            # 埋め込みベクトルを生成（正規化あり）
            embeddings = self.embedder.encode(
                documents,
                normalize_embeddings=True,
                show_progress_bar=False
            )
            embeddings = np.array(embeddings).astype('float32')

            # FAISSインデックスを初期化（初回のみ）
            if self.index is None:
                logger.info(f"Creating new FAISS index with dimension {self.dimension}")
                self.index = faiss.IndexFlatIP(self.dimension)

            # FAISSインデックスに追加
            self.index.add(embeddings)

            # ドキュメントとメタデータを保存
            self.documents.extend(documents)
            self.metadatas.extend(metadatas)

            logger.info(f"Successfully added {len(documents)} documents. Total: {self.index.ntotal}")

        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            raise

    def save_and_upload(self) -> None:
        """FAISSインデックスとメタデータをS3にアップロード"""
        cache_dir = Path(self.local_cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)

        index_path = cache_dir / "faiss_index.bin"
        metadata_path = cache_dir / "metadata.json"

        logger.info(f"Saving FAISS index to {index_path}")
        faiss.write_index(self.index, str(index_path))

        logger.info(f"Saving metadata to {metadata_path}")
        metadata = {
            'documents': self.documents,
            'metadatas': self.metadatas,
            'embedding_model': self.embedding_model_name,
            'dimension': self.dimension,
            'total_documents': len(self.documents),
            'updated_at': datetime.now().isoformat()
        }

        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        # S3にアップロード
        index_key = f"{self.s3_prefix}faiss_index.bin"
        metadata_key = f"{self.s3_prefix}metadata.json"

        logger.info(f"Uploading to s3://{self.s3_bucket}/{index_key}")
        self.s3_client.upload_file(str(index_path), self.s3_bucket, index_key)

        logger.info(f"Uploading to s3://{self.s3_bucket}/{metadata_key}")
        self.s3_client.upload_file(str(metadata_path), self.s3_bucket, metadata_key)

        logger.info(f"Successfully uploaded to S3")

    def get_stats(self) -> Dict[str, Any]:
        """インデックスの統計情報を取得"""
        # 埋め込みモデルをロード（dimensionが必要な場合）
        if self.dimension is None:
            self._ensure_embedder_loaded()

        return {
            'total_documents': len(self.documents),
            'total_vectors': self.index.ntotal if self.index else 0,
            'dimension': self.dimension if self.dimension else 0,
            'embedding_model': self.embedding_model_name,
            's3_bucket': self.s3_bucket,
            's3_prefix': self.s3_prefix
        }


# グローバルFAISSマネージャー（シングルトン）
_faiss_manager: Optional[FAISSManager] = None


def get_faiss_manager() -> FAISSManager:
    """FAISSマネージャーを取得（遅延初期化）"""
    global _faiss_manager
    if _faiss_manager is None:
        _faiss_manager = FAISSManager()
    return _faiss_manager


# ==========================================
# API Endpoints
# ==========================================

@router.post(
    "/ingest/s3-html",
    response_model=IngestResponse,
    summary="S3のHTMLファイルをFAISSに取り込む"
)
def ingest_s3_html(request: S3HTMLIngestRequest):
    """
    S3に保存されているHTMLファイルをFAISSベクトルDBに取り込みます。

    処理内容:
    1. S3からHTMLファイルをダウンロード
    2. HTMLをテキストに変換してチャンク分割
    3. FAISSインデックスに追加
    4. S3に更新したインデックスをアップロード
    5. 自動的にFAISSインデックスをリロード

    Args:
        request: 取り込みリクエスト

    Returns:
        処理結果（成功/失敗、統計情報）
    """
    errors = []
    files_processed = 0
    documents_added = 0

    try:
        # FAISSマネージャーを取得
        manager = get_faiss_manager()
        processor = TextProcessor()

        # S3クライアント
        s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'ap-northeast-1'))

        # 各HTMLファイルを処理
        for s3_key in request.s3_keys:
            try:
                logger.info(f"Processing s3://{request.s3_bucket}/{s3_key}")

                # S3からHTMLを取得
                response = s3_client.get_object(Bucket=request.s3_bucket, Key=s3_key)
                html_content = response['Body'].read().decode('utf-8')

                # HTMLをテキストに変換
                text = processor.clean_html(html_content)

                if not text:
                    logger.warning(f"No text extracted from {s3_key}")
                    errors.append(f"No text content in {s3_key}")
                    continue

                # テキストをチャンク分割
                chunks = processor.chunk_text(text, request.chunk_size, request.chunk_overlap)

                # メタデータを作成
                base_metadata = {
                    'source': 's3',
                    's3_bucket': request.s3_bucket,
                    's3_key': s3_key,
                    'filename': Path(s3_key).name,
                    'indexed_at': datetime.now().isoformat()
                }

                if request.course_id:
                    base_metadata['course_id'] = request.course_id
                if request.course_name:
                    base_metadata['course_name'] = request.course_name
                if request.module_name:
                    base_metadata['module_name'] = request.module_name

                # チャンクごとのメタデータを作成
                metadatas = []
                for i, chunk in enumerate(chunks):
                    metadata = {
                        **base_metadata,
                        'chunk_index': i,
                        'total_chunks': len(chunks)
                    }
                    metadatas.append(metadata)

                # FAISSに追加
                manager.add_documents(chunks, metadatas)

                files_processed += 1
                documents_added += len(chunks)
                logger.info(f"Added {len(chunks)} chunks from {s3_key}")

            except ClientError as e:
                error_msg = f"S3 error for {s3_key}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)
            except Exception as e:
                error_msg = f"Failed to process {s3_key}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)

        # S3にアップロード
        if documents_added > 0:
            manager.save_and_upload()

            # 自動リロード
            logger.info("Reloading FAISS index after ingestion...")
            global _faiss_manager
            _faiss_manager = None
            manager = get_faiss_manager()

        stats = manager.get_stats()

        return IngestResponse(
            success=len(errors) == 0,
            message=f"Processed {files_processed} files, added {documents_added} documents",
            files_processed=files_processed,
            documents_added=documents_added,
            faiss_total_vectors=stats['total_vectors'],
            errors=errors if errors else None
        )

    except Exception as e:
        logger.error(f"Ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest HTML files: {str(e)}"
        )


@router.post(
    "/ingest/s3-prefix",
    response_model=IngestResponse,
    summary="S3プレフィックス配下のHTMLファイルを一括取り込み"
)
def ingest_s3_prefix(request: S3PrefixIngestRequest):
    """
    S3の特定プレフィックス配下のHTMLファイルを一括でFAISSに取り込みます。

    処理内容:
    1. S3プレフィックス配下のHTMLファイルをリストアップ
    2. 各ファイルをダウンロードしてテキストに変換
    3. FAISSインデックスに追加
    4. S3に更新したインデックスをアップロード
    5. 自動的にFAISSインデックスをリロード

    Args:
        request: 取り込みリクエスト

    Returns:
        処理結果（成功/失敗、統計情報）
    """
    try:
        # S3クライアント
        s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'ap-northeast-1'))

        # S3プレフィックス配下のHTMLファイルをリストアップ
        logger.info(f"Listing HTML files in s3://{request.s3_bucket}/{request.s3_prefix}")

        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=request.s3_bucket, Prefix=request.s3_prefix)

        html_keys = []
        for page in pages:
            if 'Contents' not in page:
                continue

            for obj in page['Contents']:
                key = obj['Key']
                # HTMLファイルのみ抽出
                if key.lower().endswith(('.html', '.htm')):
                    html_keys.append(key)

        logger.info(f"Found {len(html_keys)} HTML files")

        if not html_keys:
            manager = get_faiss_manager()
            stats = manager.get_stats()
            return IngestResponse(
                success=True,
                message=f"No HTML files found in s3://{request.s3_bucket}/{request.s3_prefix}",
                files_processed=0,
                documents_added=0,
                faiss_total_vectors=stats['total_vectors'],
                errors=None
            )

        # S3HTMLIngestRequestに変換して実行
        ingest_request = S3HTMLIngestRequest(
            s3_bucket=request.s3_bucket,
            s3_keys=html_keys,
            course_id=request.course_id,
            course_name=request.course_name,
            module_name=request.module_name,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap
        )

        return ingest_s3_html(ingest_request)

    except Exception as e:
        logger.error(f"Prefix ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest HTML files from prefix: {str(e)}"
        )


@router.post(
    "/ingest/s3-today",
    response_model=IngestResponse,
    summary="当日追加されたHTMLファイルをFAISSに取り込む"
)
def ingest_s3_today(request: S3TodayIngestRequest):
    """
    S3に当日追加されたHTMLファイルをFAISSベクトルDBに取り込みます。

    処理内容:
    1. S3プレフィックス配下のHTMLファイルで当日追加されたものをリストアップ
    2. 各ファイルをダウンロードしてテキストに変換
    3. FAISSインデックスに追加
    4. S3に更新したインデックスをアップロード
    5. 自動的にFAISSインデックスをリロード

    Args:
        request: 取り込みリクエスト

    Returns:
        処理結果（成功/失敗、統計情報）
    """
    try:
        # S3クライアント
        s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'ap-northeast-1'))

        # 当日の開始時刻（00:00:00 UTC）タイムゾーン付き
        from datetime import timezone
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        # S3プレフィックス配下のHTMLファイルをリストアップ
        logger.info(f"Listing today's HTML files in s3://{request.s3_bucket}/{request.s3_prefix}")

        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=request.s3_bucket, Prefix=request.s3_prefix)

        today_html_keys = []
        for page in pages:
            if 'Contents' not in page:
                continue

            for obj in page['Contents']:
                key = obj['Key']
                last_modified = obj['LastModified']

                # HTMLファイルで当日に追加/更新されたものを抽出
                if key.lower().endswith(('.html', '.htm')) and last_modified >= today_start:
                    today_html_keys.append(key)
                    logger.info(f"Found today's file: {key} (modified: {last_modified})")

        logger.info(f"Found {len(today_html_keys)} HTML files added/modified today")

        if not today_html_keys:
            manager = get_faiss_manager()
            stats = manager.get_stats()
            return IngestResponse(
                success=True,
                message=f"No HTML files added today in s3://{request.s3_bucket}/{request.s3_prefix}",
                files_processed=0,
                documents_added=0,
                faiss_total_vectors=stats['total_vectors'],
                errors=None
            )

        # S3HTMLIngestRequestに変換して実行
        ingest_request = S3HTMLIngestRequest(
            s3_bucket=request.s3_bucket,
            s3_keys=today_html_keys,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap
        )

        return ingest_s3_html(ingest_request)

    except Exception as e:
        logger.error(f"Today's ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest today's HTML files: {str(e)}"
        )


@router.post(
    "/ingest/s3-all",
    response_model=IngestResponse,
    summary="全HTMLファイルをFAISSに取り込む"
)
def ingest_s3_all(request: S3AllIngestRequest):
    """
    S3プレフィックス配下の全HTMLファイルをFAISSベクトルDBに取り込みます。

    処理内容:
    1. S3プレフィックス配下の全HTMLファイルをリストアップ
    2. 各ファイルをダウンロードしてテキストに変換
    3. FAISSインデックスに追加
    4. S3に更新したインデックスをアップロード
    5. 自動的にFAISSインデックスをリロード

    Args:
        request: 取り込みリクエスト

    Returns:
        処理結果（成功/失敗、統計情報）
    """
    try:
        # S3クライアント
        s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'ap-northeast-1'))

        # S3プレフィックス配下の全HTMLファイルをリストアップ
        logger.info(f"Listing all HTML files in s3://{request.s3_bucket}/{request.s3_prefix}")

        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=request.s3_bucket, Prefix=request.s3_prefix)

        all_html_keys = []
        for page in pages:
            if 'Contents' not in page:
                continue

            for obj in page['Contents']:
                key = obj['Key']

                # HTMLファイルを抽出
                if key.lower().endswith(('.html', '.htm')):
                    all_html_keys.append(key)
                    logger.info(f"Found HTML file: {key}")

        logger.info(f"Found {len(all_html_keys)} HTML files in total")

        if not all_html_keys:
            manager = get_faiss_manager()
            stats = manager.get_stats()
            return IngestResponse(
                success=True,
                message=f"No HTML files found in s3://{request.s3_bucket}/{request.s3_prefix}",
                files_processed=0,
                documents_added=0,
                faiss_total_vectors=stats['total_vectors'],
                errors=None
            )

        # S3HTMLIngestRequestに変換して実行
        ingest_request = S3HTMLIngestRequest(
            s3_bucket=request.s3_bucket,
            s3_keys=all_html_keys,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap
        )

        return ingest_s3_html(ingest_request)

    except Exception as e:
        logger.error(f"All files ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest all HTML files: {str(e)}"
        )


@router.get(
    "/stats",
    response_model=FAISSStatsResponse,
    summary="FAISS統計情報を取得"
)
def get_faiss_stats():
    """
    FAISSベクトルDBの統計情報を取得します。

    Returns:
        統計情報（総ドキュメント数、総ベクトル数、使用モデルなど）
    """
    try:
        manager = get_faiss_manager()
        stats = manager.get_stats()

        return FAISSStatsResponse(**stats)

    except Exception as e:
        logger.error(f"Failed to get stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get FAISS stats: {str(e)}"
        )


@router.post(
    "/reload",
    summary="S3からFAISSインデックスをリロード"
)
def reload_faiss_index():
    """
    S3から最新のFAISSインデックスをリロードします。

    新しいデータがS3にアップロードされた後に実行してください。
    通常は取り込み処理後に自動実行されますが、緊急時やトラブルシューティング用に手動実行も可能です。

    Returns:
        リロード結果
    """
    try:
        global _faiss_manager
        _faiss_manager = None  # 既存のマネージャーをクリア

        manager = get_faiss_manager()  # 再初期化
        stats = manager.get_stats()

        return {
            "success": True,
            "message": "FAISS index reloaded successfully",
            "stats": stats
        }

    except Exception as e:
        logger.error(f"Failed to reload index: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reload FAISS index: {str(e)}"
        )
