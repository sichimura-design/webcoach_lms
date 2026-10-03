"""
S3 HTML to FAISS Ingestion Endpoints

This router provides endpoints to ingest HTML content from S3 into FAISS vector database.
"""
import os
import logging
import threading
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

        # VECTOR_DB_ENV=keyword のときは埋め込みを作らず、教材本文(metadata.json)だけを
        # 更新する（チャット側はvector_db.KeywordRetrieverが本文から索引を作る）。
        # sentence-transformers(torch)はkeywordモードではインストールしない前提
        self.use_embeddings = os.getenv('VECTOR_DB_ENV', '') != 'keyword'

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
            if not self.use_embeddings:
                logger.info(f"Downloading metadata from s3://{self.s3_bucket}/{metadata_key} (keyword mode)")
                self.s3_client.download_file(self.s3_bucket, metadata_key, str(metadata_path))
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                self.documents = metadata.get('documents', [])
                self.metadatas = metadata.get('metadatas', [])
                logger.info(f"Loaded {len(self.documents)} documents from S3")
                return

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

        if not self.use_embeddings:
            self.documents.extend(documents)
            self.metadatas.extend(metadatas)
            logger.info(f"Added {len(documents)} documents (keyword mode). Total: {len(self.documents)}")
            return

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

        if self.use_embeddings:
            logger.info(f"Saving FAISS index to {index_path}")
            faiss.write_index(self.index, str(index_path))

        logger.info(f"Saving metadata to {metadata_path}")
        metadata = {
            'documents': self.documents,
            'metadatas': self.metadatas,
            # keywordモードでは埋め込みを作らないので、S3上の古いfaiss_index.binとは件数が合わなくなる
            # (FAISSRetriever側で件数不一致を検知して使わない)
            'embedding_model': self.embedding_model_name if self.use_embeddings else None,
            'dimension': self.dimension,
            'total_documents': len(self.documents),
            'updated_at': datetime.now().isoformat()
        }

        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        # S3にアップロード
        index_key = f"{self.s3_prefix}faiss_index.bin"
        metadata_key = f"{self.s3_prefix}metadata.json"

        if self.use_embeddings:
            logger.info(f"Uploading to s3://{self.s3_bucket}/{index_key}")
            self.s3_client.upload_file(str(index_path), self.s3_bucket, index_key)

        logger.info(f"Uploading to s3://{self.s3_bucket}/{metadata_key}")
        self.s3_client.upload_file(str(metadata_path), self.s3_bucket, metadata_key)

        logger.info(f"Successfully uploaded to S3")

    def get_stats(self) -> Dict[str, Any]:
        """インデックスの統計情報を取得"""
        # 埋め込みモデルをロード（dimensionが必要な場合）
        if self.dimension is None and self.use_embeddings:
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


# ==========================================
# Moodleの教材リンクから索引を作り直す
# ==========================================

class MoodleMaterialsRebuildRequest(BaseModel):
    """Moodle教材からの索引再構築リクエスト"""
    url_pattern: str = Field("%/materials/%", description="対象にするURLモジュール(mdl_url.externalurl)のLIKEパターン")
    course_ids: Optional[List[int]] = Field(None, description="対象コースを絞る場合のコースID（省略時は全コース）")
    chunk_size: int = Field(1000, description="テキストのチャンクサイズ", ge=100, le=5000)
    chunk_overlap: int = Field(200, description="チャンクのオーバーラップサイズ", ge=0, le=1000)
    max_workers: int = Field(8, description="教材HTMLの同時取得数", ge=1, le=16)
    added_today: bool = Field(False, description="当日(日本時間)にコースへ追加された教材だけを、既存の索引に書き足す")


def _today_start_epoch() -> int:
    """日本時間の当日0時（Moodleのcourse_modules.addedと同じUNIX秒）"""
    from datetime import timezone, timedelta
    jst = timezone(timedelta(hours=9))
    return int(datetime.now(jst).replace(hour=0, minute=0, second=0, microsecond=0).timestamp())


def fetch_moodle_material_modules(
    url_pattern: str, course_ids: Optional[List[int]] = None, added_since: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Moodleのコースに登録された教材(URLモジュール)を、コース・セクション・レッスン名つきで返す。

    1つの教材HTMLが複数コースに登録されていることがあるので、行は(コース, モジュール)単位。
    """
    from sqlalchemy import text, bindparam
    from database import engine

    sql = """
        SELECT cm.id AS cmid, c.id AS course_id, c.fullname AS course_name,
               cs.section AS section_no, cs.name AS section_name,
               u.name AS lesson_name, u.externalurl AS url
        FROM mdl_url u
        JOIN mdl_course_modules cm ON cm.instance = u.id
        JOIN mdl_modules m ON m.id = cm.module AND m.name = 'url'
        JOIN mdl_course c ON c.id = cm.course
        LEFT JOIN mdl_course_sections cs ON cs.id = cm.section
        WHERE u.externalurl LIKE :pattern AND cm.deletioninprogress = 0
    """
    params: Dict[str, Any] = {"pattern": url_pattern}
    stmt_extra = ""
    if course_ids:
        stmt_extra = " AND c.id IN :course_ids"
        params["course_ids"] = list(course_ids)
    if added_since is not None:
        stmt_extra += " AND cm.added >= :added_since"
        params["added_since"] = added_since
    stmt = text(sql + stmt_extra + " ORDER BY c.id, cs.section, cm.id")
    if course_ids:
        stmt = stmt.bindparams(bindparam("course_ids", expanding=True))

    with engine.connect() as conn:
        return [dict(row._mapping) for row in conn.execute(stmt, params)]


def _fetch_material_text(url: str) -> str:
    import requests

    response = requests.get(url, timeout=(10, 30))
    response.raise_for_status()
    # Content-Typeにcharsetが無いとrequestsはISO-8859-1扱いにするので、bytesのまま渡して
    # BeautifulSoupにHTML内のmeta charsetで判定させる
    return TextProcessor.clean_html(response.content)


def _rebuild_from_moodle_materials(request: MoodleMaterialsRebuildRequest, progress: Dict[str, Any]) -> IngestResponse:
    """Moodleの教材HTMLを取得して索引を置き換える本体。進み具合をprogressに書く"""
    from concurrent.futures import ThreadPoolExecutor

    progress['phase'] = 'listing'
    added_since = _today_start_epoch() if request.added_today else None
    modules = fetch_moodle_material_modules(request.url_pattern, request.course_ids, added_since)
    logger.info(f"Moodle material modules: {len(modules)}")
    if not modules and request.added_today:
        # 当日分が無いのは正常。索引は触らない
        stats = get_faiss_manager().get_stats()
        return IngestResponse(
            success=True,
            message="No Moodle material modules were added today",
            files_processed=0,
            documents_added=0,
            faiss_total_vectors=stats['total_vectors'] or stats['total_documents'],
            errors=None,
        )
    if not modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No Moodle URL modules match {request.url_pattern}",
        )

    # 同じHTMLが複数コースにあるので、取得はURL単位で1回
    urls = list(dict.fromkeys(m["url"] for m in modules))
    texts: Dict[str, str] = {}
    errors: List[str] = []
    progress.update(phase='fetching', total_pages=len(urls), fetched_pages=0)

    def fetch(url: str):
        try:
            return url, _fetch_material_text(url), None
        except Exception as e:
            return url, "", f"Failed to fetch {url}: {e}"

    with ThreadPoolExecutor(max_workers=request.max_workers) as pool:
        for url, text_content, error in pool.map(fetch, urls):
            if error:
                errors.append(error)
            elif not text_content:
                errors.append(f"No text content in {url}")
            else:
                texts[url] = text_content
            progress['fetched_pages'] += 1

    progress['phase'] = 'indexing'
    processor = TextProcessor()
    indexed_at = datetime.now().isoformat()
    documents: List[str] = []
    metadatas: List[Dict[str, Any]] = []
    files_processed = 0
    for module in modules:
        text_content = texts.get(module["url"])
        if not text_content:
            continue
        chunks = processor.chunk_text(text_content, request.chunk_size, request.chunk_overlap)
        base_metadata = {
            'source': 'moodle_url',
            'course_id': module["course_id"],
            'course_name': module["course_name"],
            'section_name': module["section_name"] or '',
            'section_no': module["section_no"],
            # retrieve_nodeは参照元表示にmodule_nameを使う
            'module_name': module["lesson_name"],
            'cmid': module["cmid"],
            'url': module["url"],
            'filename': Path(module["url"]).name,
            'indexed_at': indexed_at,
        }
        for i, chunk in enumerate(chunks):
            documents.append(chunk)
            metadatas.append({**base_metadata, 'chunk_index': i, 'total_chunks': len(chunks)})
        files_processed += 1

    if not documents:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No material text could be fetched. errors={errors[:5]}",
        )

    manager = get_faiss_manager()
    if request.added_today:
        # 書き足し。同じモジュールを2回取り込んだときに重複しないよう、そのモジュールの古いチャンクだけ外す
        cmids = {m["cmid"] for m in modules}
        kept = [(d, m) for d, m in zip(manager.documents, manager.metadatas) if m.get('cmid') not in cmids]
    elif request.course_ids:
        targets = set(request.course_ids)
        kept = [(d, m) for d, m in zip(manager.documents, manager.metadatas) if m.get('course_id') not in targets]
    else:
        kept = []
    manager.documents = []
    manager.metadatas = []
    manager.index = None  # 埋め込みモードでも作り直す
    if kept:
        manager.add_documents([d for d, _ in kept], [m for _, m in kept])
    manager.add_documents(documents, metadatas)
    manager.save_and_upload()

    global _faiss_manager
    _faiss_manager = None
    manager = get_faiss_manager()
    stats = manager.get_stats()

    # AIチャット側の検索(learning_coach_agent.vector_db)も読み直す
    from agents.learning_coach_agent import reload_vector_db
    reload_vector_db()

    return IngestResponse(
        success=len(errors) == 0,
        message=(
            ("Added" if request.added_today else "Rebuilt index from") + f" {files_processed} Moodle modules ({len(texts)} unique pages), "
            f"{len(documents)} chunks" + (f", kept {len(kept)} existing chunks" if kept else "")
        ),
        files_processed=files_processed,
        documents_added=len(documents),
        faiss_total_vectors=stats['total_vectors'] or stats['total_documents'],
        errors=errors if errors else None,
    )


@router.post(
    "/ingest/moodle-materials",
    response_model=IngestResponse,
    summary="Moodleの教材リンクから索引を作り直す（既存の索引は置き換える）"
)
def rebuild_from_moodle_materials(request: MoodleMaterialsRebuildRequest):
    """
    Moodleのコースに登録された教材(URLモジュール)のHTMLを取得し、コースID・レッスン名つきで
    索引を作り直します。AIチャットのRAGはcourse_idで教材を絞るので、course_idの無い索引は
    コースで絞ると0件になる。既存の索引（metadata.json）はすべて置き換える。

    course_idsを指定した場合は、そのコースのチャンクだけを入れ替え、他コースのチャンクは残す。
    added_today=trueなら、当日(日本時間)にコースへ追加された教材だけを既存の索引に書き足す。
    完了まで待つ版。管理画面からは時間制限(CloudFront 60秒)があるので /start と /status を使う。
    """
    try:
        return _rebuild_from_moodle_materials(request, {})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Moodle materials rebuild failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rebuild index from Moodle materials: {str(e)}"
        )


# 管理画面からの再構築ジョブ（同時に1つだけ）。プロセス内の状態なので、複数プロセス化したら
# 共有ストアへ移す（project_dify-redis-migration-todoと同じ課題）
_rebuild_job: Dict[str, Any] = {'status': 'idle'}
_rebuild_job_lock = threading.Lock()


def _run_rebuild_job(request: MoodleMaterialsRebuildRequest) -> None:
    try:
        result = _rebuild_from_moodle_materials(request, _rebuild_job)
        _rebuild_job.update(status='succeeded', result=result.model_dump())
    except HTTPException as e:
        _rebuild_job.update(status='failed', error=str(e.detail))
    except Exception as e:
        logger.error(f"Moodle materials rebuild job failed: {e}", exc_info=True)
        _rebuild_job.update(status='failed', error=str(e))
    finally:
        _rebuild_job['finished_at'] = datetime.now().isoformat()


@router.post(
    "/ingest/moodle-materials/start",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Moodle教材からの索引再構築をバックグラウンドで開始する"
)
def start_rebuild_from_moodle_materials(request: MoodleMaterialsRebuildRequest):
    """再構築を別スレッドで始めてすぐ返す。進み具合は /ingest/moodle-materials/status で見る"""
    with _rebuild_job_lock:
        if _rebuild_job.get('status') == 'running':
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Rebuild is already running")
        _rebuild_job.clear()
        _rebuild_job.update(
            status='running', phase='starting', mode='today' if request.added_today else 'all',
            started_at=datetime.now().isoformat(),
        )
    threading.Thread(target=_run_rebuild_job, args=(request,), daemon=True).start()
    return dict(_rebuild_job)


@router.get(
    "/ingest/moodle-materials/status",
    summary="Moodle教材からの索引再構築の進み具合"
)
def get_rebuild_from_moodle_materials_status():
    return dict(_rebuild_job)


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

        # AIチャット側の検索(learning_coach_agent.vector_db)も読み直す
        from agents.learning_coach_agent import reload_vector_db
        reload_vector_db()

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
