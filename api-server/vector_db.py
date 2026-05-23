"""
Vector Database Abstraction Layer
ChromaDB (test), FAISS+S3, and Aurora pgvector (production)
"""
import os
import logging
import json
import tempfile
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
from pathlib import Path

import chromadb
import numpy as np

logger = logging.getLogger(__name__)


class VectorDBRetriever(ABC):
    """ベクトルDBリトリーバーの抽象基底クラス"""

    @abstractmethod
    def search(
        self,
        query: str,
        n_results: int = 5,
        course_id: Optional[int] = None,
        module_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        ベクトル検索を実行

        Args:
            query: 検索クエリ
            n_results: 取得する結果数
            course_id: コースIDでフィルタ
            module_name: モジュール名でフィルタ

        Returns:
            検索結果（documents, metadatas, distances）
        """
        pass

    @abstractmethod
    def get_document_count(self) -> int:
        """ドキュメント総数を取得"""
        pass


class ChromaDBRetriever(VectorDBRetriever):
    """ChromaDB リトリーバー（テスト環境）"""

    def __init__(self, chromadb_path: str = None, collection_name: str = "moodle_resources"):
        """
        ChromaDB リトリーバーを初期化

        Args:
            chromadb_path: ChromaDBのパス
            collection_name: コレクション名
        """
        self.chromadb_path = chromadb_path or os.getenv('CHROMADB_PATH', '/app/chromadb')
        self.collection_name = collection_name
        self.client = None
        self.collection = None

        try:
            logger.info(f"Connecting to ChromaDB at {self.chromadb_path}")
            self.client = chromadb.PersistentClient(path=self.chromadb_path)
            self.collection = self.client.get_collection(name=self.collection_name)
            logger.info(f"ChromaDB connected. Total documents: {self.collection.count()}")
        except Exception as e:
            logger.error(f"Failed to connect to ChromaDB: {e}")
            raise

    def search(
        self,
        query: str,
        n_results: int = 5,
        course_id: Optional[int] = None,
        module_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """ChromaDBでベクトル検索"""
        if not self.collection:
            raise RuntimeError("ChromaDB collection not initialized")

        # フィルタ条件を構築
        where_filter = None
        if course_id is not None and module_name is not None:
            where_filter = {
                "$and": [
                    {"course_id": course_id},
                    {"module_name": module_name}
                ]
            }
        elif course_id is not None:
            where_filter = {"course_id": course_id}
        elif module_name is not None:
            where_filter = {"module_name": module_name}

        logger.info(f"ChromaDB search: query='{query}', filter={where_filter}, n_results={n_results}")

        # ベクトル検索実行
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        return results

    def get_document_count(self) -> int:
        """ChromaDBのドキュメント総数を取得"""
        if not self.collection:
            return 0
        return self.collection.count()


class FAISSRetriever(VectorDBRetriever):
    """FAISS + S3 リトリーバー（本番環境）"""

    def __init__(
        self,
        s3_bucket: str = None,
        s3_prefix: str = "vector_db/",
        aws_region: str = None,
        embedding_model: str = "all-MiniLM-L6-v2",
        local_cache_dir: str = None
    ):
        """
        FAISS + S3 リトリーバーを初期化

        Args:
            s3_bucket: S3バケット名
            s3_prefix: S3プレフィックス（デフォルト: vector_db/）
            aws_region: AWSリージョン
            embedding_model: 埋め込みモデル名
            local_cache_dir: ローカルキャッシュディレクトリ
        """
        self.s3_bucket = s3_bucket or os.getenv('S3_BUCKET_NAME')
        self.s3_prefix = s3_prefix
        self.aws_region = aws_region or os.getenv('AWS_REGION', 'ap-northeast-1')
        self.embedding_model_name = embedding_model
        self.local_cache_dir = local_cache_dir or os.getenv('FAISS_CACHE_DIR', '/tmp/faiss_cache')

        self.index = None
        self.documents = []
        self.metadatas = []
        self.embedder = None

        if not self.s3_bucket:
            raise ValueError("S3_BUCKET_NAME environment variable or s3_bucket parameter is required")

        logger.info(f"Initializing FAISS retriever with S3 bucket: {self.s3_bucket}")

        try:
            # S3クライアントの初期化
            import boto3
            self.s3_client = boto3.client('s3', region_name=self.aws_region)

            # 埋め込みモデルの初期化
            from sentence_transformers import SentenceTransformer
            self.embedder = SentenceTransformer(self.embedding_model_name)
            logger.info(f"Loaded embedding model: {self.embedding_model_name}")

            # FAISSインデックスとメタデータをS3からロード
            self._load_from_s3()

            logger.info(f"FAISS retriever initialized. Total documents: {len(self.documents)}")

        except Exception as e:
            logger.error(f"Failed to initialize FAISS retriever: {e}")
            raise

    def _load_from_s3(self):
        """S3からFAISSインデックスとメタデータをロード"""
        import faiss

        # ローカルキャッシュディレクトリを作成
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

        except Exception as e:
            logger.error(f"Failed to load from S3: {e}")
            # S3にファイルが存在しない場合は空のインデックスを作成
            logger.warning("Creating empty FAISS index")
            dimension = self.embedder.get_sentence_embedding_dimension()
            self.index = faiss.IndexFlatIP(dimension)  # Inner Product (コサイン類似度用)
            self.documents = []
            self.metadatas = []

    def search(
        self,
        query: str,
        n_results: int = 5,
        course_id: Optional[int] = None,
        module_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """FAISSでベクトル検索"""
        if self.index is None or self.index.ntotal == 0:
            logger.warning("FAISS index is empty")
            return {
                "documents": [[]],
                "metadatas": [[]],
                "distances": [[]]
            }

        try:
            # クエリを埋め込みベクトルに変換
            query_embedding = self.embedder.encode([query], normalize_embeddings=True)
            query_vector = np.array(query_embedding).astype('float32')

            # FAISS検索（全件）
            # より多くの結果を取得してフィルタリング
            k = min(self.index.ntotal, n_results * 10)
            distances, indices = self.index.search(query_vector, k)

            # 結果をフィルタリング
            filtered_documents = []
            filtered_metadatas = []
            filtered_distances = []

            for dist, idx in zip(distances[0], indices[0]):
                if idx == -1:  # 無効なインデックス
                    continue

                metadata = self.metadatas[idx]

                # フィルタ条件をチェック
                if course_id is not None and metadata.get('course_id') != course_id:
                    continue
                if module_name is not None and metadata.get('module_name') != module_name:
                    continue

                filtered_documents.append(self.documents[idx])
                filtered_metadatas.append(metadata)
                # Inner Productの距離をコサイン類似度の距離に変換（1 - similarity）
                filtered_distances.append(1.0 - float(dist))

                if len(filtered_documents) >= n_results:
                    break

            logger.info(f"FAISS search: found {len(filtered_documents)} results for query '{query[:50]}...'")

            return {
                "documents": [filtered_documents],
                "metadatas": [filtered_metadatas],
                "distances": [filtered_distances]
            }

        except Exception as e:
            logger.error(f"FAISS search failed: {e}")
            return {
                "documents": [[]],
                "metadatas": [[]],
                "distances": [[]]
            }

    def get_document_count(self) -> int:
        """FAISSのドキュメント総数を取得"""
        if self.index is None:
            return 0
        return self.index.ntotal


class AuroraPgvectorRetriever(VectorDBRetriever):
    """Aurora pgvector リトリーバー（本番環境）"""

    def __init__(self, db_session=None):
        """
        Aurora pgvector リトリーバーを初期化

        Args:
            db_session: SQLAlchemyのDBセッション
        """
        self.db_session = db_session
        logger.info("Aurora pgvector retriever initialized (stub implementation)")

    def search(
        self,
        query: str,
        n_results: int = 5,
        course_id: Optional[int] = None,
        module_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Aurora pgvectorでベクトル検索（空実装）

        Note: 本番環境では、以下の実装が必要:
        1. SQLAlchemyモデルでpgvector型のembeddingカラムを定義
        2. text-embedding-3-small等で埋め込みベクトル生成
        3. pgvectorの<=>演算子でコサイン類似度検索
        4. WHEREでcourse_id, module_nameフィルタ
        """
        logger.warning("Aurora pgvector search is not implemented yet (stub)")

        # TODO: 本番実装
        # from sqlalchemy import text
        # query_embedding = generate_embedding(query)  # 埋め込み生成
        # sql = text("""
        #     SELECT id, content, metadata,
        #            1 - (embedding <=> :query_embedding) as similarity
        #     FROM course_embeddings
        #     WHERE course_id = :course_id
        #     ORDER BY embedding <=> :query_embedding
        #     LIMIT :limit
        # """)
        # results = self.db_session.execute(
        #     sql,
        #     {"query_embedding": query_embedding, "course_id": course_id, "limit": n_results}
        # ).fetchall()

        # 空の結果を返す
        return {
            "documents": [[]],
            "metadatas": [[]],
            "distances": [[]]
        }

    def get_document_count(self) -> int:
        """Aurora pgvectorのドキュメント総数を取得（空実装）"""
        logger.warning("Aurora pgvector document count is not implemented yet (stub)")
        return 0


def get_vector_db_retriever(environment: str = None, db_session=None) -> VectorDBRetriever:
    """
    環境に応じたベクトルDBリトリーバーを取得

    Args:
        environment: 実行環境（"chromadb", "faiss", "pgvector", None=環境変数から判定）
        db_session: DBセッション（Aurora pgvector用）

    Returns:
        VectorDBRetriever: 適切なリトリーバー実装
    """
    if environment is None:
        environment = os.getenv("VECTOR_DB_ENV", "chromadb")

    logger.info(f"Initializing vector DB retriever for environment: {environment}")

    if environment == "faiss":
        return FAISSRetriever()
    elif environment == "pgvector":
        return AuroraPgvectorRetriever(db_session=db_session)
    else:  # chromadb (default)
        return ChromaDBRetriever()
