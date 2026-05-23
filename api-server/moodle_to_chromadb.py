#!/usr/bin/env python3
"""
Moodle Resource to ChromaDB Indexer

このスクリプトは、MoodleのコースコンテンツをChromaDBに登録します。
HTMLファイル、ページコンテンツ、リソースなどをベクトル化し、検索可能にします。

Usage:
    python moodle_to_chromadb.py --url <moodle_url> --token <ws_token> [--openai-key <key>]

Requirements:
    - Moodle Web Service API アクセス
    - OpenAI API Key (または別の埋め込みモデル)
"""

import argparse
import logging
import os
import sys
import json
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

import requests
from bs4 import BeautifulSoup
import markdown
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MoodleClient:
    """Moodle Web Service APIクライアント"""

    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = requests.Session()

    def _make_request(self, wsfunction: str, params: Dict[str, Any] = None) -> Any:
        """Moodle Web Service APIリクエスト"""
        url = f"{self.base_url}/webservice/rest/server.php"

        data = {
            'wstoken': self.token,
            'wsfunction': wsfunction,
            'moodlewsrestformat': 'json'
        }

        if params:
            data.update(params)

        try:
            response = self.session.post(url, data=data, timeout=30)
            response.raise_for_status()

            result = response.json()

            # エラーチェック
            if isinstance(result, dict) and result.get('exception'):
                raise Exception(f"Moodle API Error: {result.get('message', 'Unknown error')}")

            return result

        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise

    def get_courses(self) -> List[Dict[str, Any]]:
        """登録されているコース一覧を取得"""
        logger.info("Fetching courses...")
        result = self._make_request(
            'core_course_get_enrolled_courses_by_timeline_classification',
            {'classification': 'all', 'limit': 0, 'offset': 0}
        )
        courses = result.get('courses', [])
        logger.info(f"Found {len(courses)} courses")
        return courses

    def get_course_contents(self, course_id: int) -> List[Dict[str, Any]]:
        """コースのコンテンツを取得"""
        logger.info(f"Fetching contents for course {course_id}...")
        result = self._make_request(
            'core_course_get_contents',
            {'courseid': course_id}
        )
        return result if isinstance(result, list) else []

    def get_html_content(self, file_url: str) -> Optional[str]:
        """HTMLファイルのコンテンツを取得"""
        try:
            # URLにトークンを追加
            separator = '&' if '?' in file_url else '?'
            url_with_token = f"{file_url}{separator}token={self.token}"

            response = self.session.get(url_with_token, timeout=10)
            response.raise_for_status()

            return response.text
        except Exception as e:
            logger.warning(f"Failed to fetch HTML from {file_url}: {e}")
            return None


class TextProcessor:
    """テキスト処理とチャンク分割"""

    @staticmethod
    def clean_html(html_content: str) -> str:
        """HTMLからテキストを抽出"""
        soup = BeautifulSoup(html_content, 'lxml')

        # スクリプトとスタイルを削除
        for element in soup(['script', 'style', 'nav', 'footer']):
            element.decompose()

        text = soup.get_text(separator='\n', strip=True)

        # 連続する空白行を削除
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)

    @staticmethod
    def markdown_to_text(md_content: str) -> str:
        """MarkdownをテキストまたはHTMLに変換"""
        html = markdown.markdown(md_content)
        return TextProcessor.clean_html(html)

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
                for delimiter in ['\n\n', '\n', '. ', '。', '! ', '！', '? ', '？']:
                    pos = text.rfind(delimiter, start, end)
                    if pos != -1:
                        end = pos + len(delimiter)
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap

        return chunks


class ChromaDBIndexer:
    """ChromaDBインデクサー"""

    def __init__(self, db_path: str = "./chromadb", collection_name: str = "moodle_resources",
                 openai_api_key: Optional[str] = None):
        """
        Args:
            db_path: ChromaDBのデータディレクトリ
            collection_name: コレクション名
            openai_api_key: OpenAI API Key (指定しない場合はデフォルト埋め込み)
        """
        self.db_path = Path(db_path)
        self.db_path.mkdir(parents=True, exist_ok=True)

        # ChromaDBクライアントを初期化
        self.client = chromadb.PersistentClient(path=str(self.db_path))

        # 埋め込み関数を設定
        if openai_api_key:
            logger.info("Using OpenAI embeddings")
            embedding_function = embedding_functions.OpenAIEmbeddingFunction(
                api_key=openai_api_key,
                model_name="text-embedding-3-small"
            )
        else:
            logger.info("Using default (sentence-transformers) embeddings")
            embedding_function = embedding_functions.DefaultEmbeddingFunction()

        # コレクションを取得または作成
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=embedding_function,
            metadata={"description": "Moodle course resources"}
        )

        logger.info(f"ChromaDB collection '{collection_name}' initialized at {self.db_path}")

    def add_documents(self, documents: List[str], metadatas: List[Dict[str, Any]],
                     ids: List[str]) -> None:
        """ドキュメントをChromaDBに追加"""
        if not documents:
            return

        logger.info(f"Adding {len(documents)} documents to ChromaDB...")

        try:
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Successfully added {len(documents)} documents")
        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            raise

    def search(self, query: str, n_results: int = 5) -> Dict[str, Any]:
        """類似ドキュメントを検索"""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        return results

    def get_stats(self) -> Dict[str, Any]:
        """コレクションの統計情報を取得"""
        count = self.collection.count()
        return {
            'total_documents': count,
            'collection_name': self.collection.name,
            'db_path': str(self.db_path)
        }


class MoodleToChromaDB:
    """MoodleコンテンツをChromaDBに登録するメインクラス"""

    def __init__(self, moodle_client: MoodleClient, indexer: ChromaDBIndexer):
        self.moodle = moodle_client
        self.indexer = indexer
        self.processor = TextProcessor()
        self.document_counter = 0

    def process_course(self, course: Dict[str, Any]) -> int:
        """コース全体を処理"""
        course_id = course['id']
        course_name = course.get('fullname', f"Course {course_id}")

        logger.info(f"Processing course: {course_name} (ID: {course_id})")

        try:
            sections = self.moodle.get_course_contents(course_id)

            documents = []
            metadatas = []
            ids = []

            for section in sections:
                section_docs = self._process_section(course, section)
                documents.extend(section_docs['documents'])
                metadatas.extend(section_docs['metadatas'])
                ids.extend(section_docs['ids'])

            # ChromaDBに追加
            if documents:
                self.indexer.add_documents(documents, metadatas, ids)

            logger.info(f"Processed {len(documents)} documents from course {course_name}")
            return len(documents)

        except Exception as e:
            logger.error(f"Failed to process course {course_id}: {e}")
            return 0

    def _process_section(self, course: Dict[str, Any], section: Dict[str, Any]) -> Dict[str, List]:
        """セクション内のモジュールを処理"""
        documents = []
        metadatas = []
        ids = []

        section_name = section.get('name', 'General')
        modules = section.get('modules', [])

        for module in modules:
            module_docs = self._process_module(course, section_name, module)
            documents.extend(module_docs['documents'])
            metadatas.extend(module_docs['metadatas'])
            ids.extend(module_docs['ids'])

        return {'documents': documents, 'metadatas': metadatas, 'ids': ids}

    def _process_module(self, course: Dict[str, Any], section_name: str,
                       module: Dict[str, Any]) -> Dict[str, List]:
        """モジュールを処理"""
        documents = []
        metadatas = []
        ids = []

        module_type = module.get('modname', 'unknown')
        module_name = module.get('name', 'Untitled')
        module_id = module.get('id', 0)

        # 基本メタデータ
        base_metadata = {
            'course_id': course['id'],
            'course_name': course.get('fullname', ''),
            'section_name': section_name,
            'module_type': module_type,
            'module_name': module_name,
            'module_id': module_id,
            'indexed_at': datetime.now().isoformat()
        }

        # ページコンテンツ
        if module_type == 'page' and 'description' in module:
            text = self.processor.clean_html(module['description'])
            if text:
                chunks = self.processor.chunk_text(text)
                for i, chunk in enumerate(chunks):
                    self.document_counter += 1
                    documents.append(chunk)
                    metadatas.append({**base_metadata, 'chunk_index': i, 'total_chunks': len(chunks)})
                    ids.append(f"module_{module_id}_chunk_{i}")

        # リソース (HTMLファイルなど)
        if module_type == 'resource' and 'contents' in module:
            for content in module['contents']:
                mimetype = content.get('mimetype', '')

                if mimetype in ['text/html', 'application/xhtml+xml']:
                    html_content = self.moodle.get_html_content(content['fileurl'])
                    if html_content:
                        text = self.processor.clean_html(html_content)
                        if text:
                            chunks = self.processor.chunk_text(text)
                            for i, chunk in enumerate(chunks):
                                self.document_counter += 1
                                documents.append(chunk)
                                metadatas.append({
                                    **base_metadata,
                                    'filename': content.get('filename', ''),
                                    'chunk_index': i,
                                    'total_chunks': len(chunks)
                                })
                                ids.append(f"resource_{module_id}_{content.get('filename', 'file')}_{i}")

                elif mimetype in ['text/markdown', 'text/plain']:
                    # Markdownファイルまたはテキストファイルの処理
                    md_content = self.moodle.get_html_content(content['fileurl'])
                    if md_content:
                        # Markdownファイル（.md）の場合は変換、それ以外はそのまま
                        filename = content.get('filename', '')
                        if filename.endswith('.md'):
                            text = self.processor.markdown_to_text(md_content)
                        else:
                            text = md_content

                        if text:
                            chunks = self.processor.chunk_text(text)
                            for i, chunk in enumerate(chunks):
                                self.document_counter += 1
                                documents.append(chunk)
                                metadatas.append({
                                    **base_metadata,
                                    'filename': filename,
                                    'chunk_index': i,
                                    'total_chunks': len(chunks)
                                })
                                ids.append(f"resource_{module_id}_{filename}_{i}")

        # URLモジュール
        if module_type == 'url':
            # URLモジュールの説明とURLを取得
            description = module.get('description', '')
            external_url = ''

            # contentsからURLを取得
            if 'contents' in module and len(module['contents']) > 0:
                external_url = module['contents'][0].get('fileurl', '')

            # メタデータにURLを追加
            url_metadata = {**base_metadata, 'external_url': external_url}

            # 説明文があればそれを登録
            if description:
                text = self.processor.clean_html(description)
                if text:
                    self.document_counter += 1
                    documents.append(text)
                    metadatas.append(url_metadata)
                    ids.append(f"url_{module_id}")
            elif external_url:
                # 説明がなくてもURLと名前を登録（検索可能にする）
                text = f"{module_name}\nURL: {external_url}"
                self.document_counter += 1
                documents.append(text)
                metadatas.append(url_metadata)
                ids.append(f"url_{module_id}")

        return {'documents': documents, 'metadatas': metadatas, 'ids': ids}

    def process_all_courses(self, course_ids: Optional[List[int]] = None) -> None:
        """全コースまたは指定されたコースを処理"""
        courses = self.moodle.get_courses()

        if course_ids:
            courses = [c for c in courses if c['id'] in course_ids]

        total_documents = 0

        for course in courses:
            doc_count = self.process_course(course)
            total_documents += doc_count

        logger.info(f"Indexing completed. Total documents: {total_documents}")
        logger.info(f"ChromaDB stats: {self.indexer.get_stats()}")


def main():
    parser = argparse.ArgumentParser(
        description='MoodleリソースをChromaDBに登録',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # 全コースをインデックス化
  python moodle_to_chromadb.py --url https://moodle.example.com --token YOUR_TOKEN

  # OpenAI埋め込みを使用
  python moodle_to_chromadb.py --url https://moodle.example.com --token YOUR_TOKEN --openai-key YOUR_OPENAI_KEY

  # 特定のコースのみインデックス化
  python moodle_to_chromadb.py --url https://moodle.example.com --token YOUR_TOKEN --courses 1 2 3

  # データベースパスを指定
  python moodle_to_chromadb.py --url https://moodle.example.com --token YOUR_TOKEN --db-path ./my_chromadb
        """
    )

    parser.add_argument('--url', required=True, help='Moodle base URL (e.g., https://moodle.example.com)')
    parser.add_argument('--token', required=True, help='Moodle Web Service token')
    parser.add_argument('--openai-key', help='OpenAI API key for embeddings (optional)')
    parser.add_argument('--db-path', default='./chromadb', help='ChromaDB database path (default: ./chromadb)')
    parser.add_argument('--collection', default='moodle_resources', help='ChromaDB collection name')
    parser.add_argument('--courses', type=int, nargs='+', help='Specific course IDs to index (optional)')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # OpenAI API Keyの取得（環境変数からも取得可能）
    openai_key = args.openai_key or os.getenv('OPENAI_API_KEY')

    try:
        # クライアントの初期化
        moodle_client = MoodleClient(args.url, args.token)
        indexer = ChromaDBIndexer(args.db_path, args.collection, openai_key)
        processor = MoodleToChromaDB(moodle_client, indexer)

        # インデックス化実行
        processor.process_all_courses(args.courses)

        logger.info("Successfully completed indexing!")

    except KeyboardInterrupt:
        logger.info("Indexing interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
