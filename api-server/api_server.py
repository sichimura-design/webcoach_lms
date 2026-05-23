#!/usr/bin/env python3
"""
Moodle LMS AI API Server
FastAPI + LangChain + Claude + ChromaDB
"""

import os
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import chromadb
from langchain_anthropic import ChatAnthropic
from langchain.prompts import ChatPromptTemplate
from langchain.schema import Document

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPIアプリ
app = FastAPI(
    title="Moodle LMS AI API",
    description="RAG-based summarization and Q&A API",
    version="1.0.0"
)

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# グローバル変数
chroma_client = None
collection = None
llm = None

# Pydanticモデル
class SummarizeRequest(BaseModel):
    """要約リクエスト"""
    course_id: int = Field(..., description="コースID")
    module_name: Optional[str] = Field(None, description="モジュール名（指定すると絞り込み）")
    query: Optional[str] = Field(None, description="特定の質問（指定するとQ&Aモード）")
    max_chunks: int = Field(5, ge=1, le=20, description="使用する最大チャンク数")


class SummarizeResponse(BaseModel):
    """要約レスポンス"""
    summary: str = Field(..., description="生成された要約")
    sources: List[Dict[str, Any]] = Field(..., description="参照元情報")
    mode: str = Field(..., description="モード（summary or qa）")


@app.on_event("startup")
async def startup_event():
    """起動時の初期化"""
    global chroma_client, collection, llm

    logger.info("Starting up API server...")

    # ChromaDB接続
    chromadb_path = os.getenv('CHROMADB_PATH', '/app/chromadb')
    logger.info(f"Connecting to ChromaDB at {chromadb_path}")

    try:
        chroma_client = chromadb.PersistentClient(path=chromadb_path)
        collection = chroma_client.get_collection(name="moodle_resources")
        logger.info(f"ChromaDB connected. Total documents: {collection.count()}")
    except Exception as e:
        logger.error(f"Failed to connect to ChromaDB: {e}")
        raise

    # Claude LLM初期化
    anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
    if not anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set. API will not work.")
    else:
        try:
            # モデル名を環境変数から取得（デフォルト: claude-3-5-haiku-20241022）
            model_name = os.getenv('ANTHROPIC_MODEL', 'claude-3-5-haiku-20241022')
            llm = ChatAnthropic(
                model=model_name,
                anthropic_api_key=anthropic_api_key,
                temperature=0.3,
                max_tokens=2048
            )
            logger.info(f"Claude LLM initialized with model: {model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize Claude LLM: {e}")
            raise

    logger.info("API server startup complete")


@app.get("/")
async def root():
    """ヘルスチェック"""
    return {
        "status": "ok",
        "service": "Moodle LMS AI API",
        "version": "1.0.0",
        "chromadb_documents": collection.count() if collection else 0
    }


@app.get("/health")
async def health_check():
    """詳細ヘルスチェック"""
    return {
        "chromadb": "ok" if collection else "error",
        "llm": "ok" if llm else "error",
        "documents": collection.count() if collection else 0
    }


@app.post("/api/summarize", response_model=SummarizeResponse)
async def summarize_content(request: SummarizeRequest):
    """
    コンテンツを要約する（RAG）

    - course_idのみ指定: コース全体の要約
    - module_name指定: 特定モジュールの要約
    - query指定: Q&Aモード（質問に回答）
    """
    if not collection or not llm:
        raise HTTPException(status_code=503, detail="Service not initialized")

    try:
        # ChromaDBからコンテンツを検索
        if request.module_name:
            # 複数条件の場合は$and演算子を使用
            where_filter = {
                "$and": [
                    {"course_id": request.course_id},
                    {"module_name": request.module_name}
                ]
            }
        else:
            # 単一条件の場合
            where_filter = {"course_id": request.course_id}

        # 検索クエリを決定
        if request.query:
            # Q&Aモード: ユーザーの質問で検索
            search_query = request.query
            mode = "qa"
        else:
            # 要約モード: モジュール名またはコースで検索
            if request.module_name:
                search_query = f"{request.module_name}の内容"
            else:
                search_query = "コース全体の概要"
            mode = "summary"

        logger.info(f"Searching ChromaDB: query='{search_query}', filter={where_filter}, n_results={request.max_chunks}")

        # ベクトル検索
        results = collection.query(
            query_texts=[search_query],
            n_results=request.max_chunks,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        if not results['documents'][0]:
            raise HTTPException(status_code=404, detail="No content found for the specified criteria")

        documents = results['documents'][0]
        metadatas = results['metadatas'][0]
        distances = results['distances'][0]

        logger.info(f"Found {len(documents)} relevant chunks")

        # コンテキストを構築
        context_parts = []
        sources = []

        for i, (doc, meta, dist) in enumerate(zip(documents, metadatas, distances)):
            context_parts.append(f"[チャンク {i+1}]\n{doc}\n")
            sources.append({
                "chunk_index": i + 1,
                "module_name": meta.get('module_name', 'Unknown'),
                "filename": meta.get('filename', ''),
                "section_name": meta.get('section_name', ''),
                "similarity": 1 - dist  # 距離を類似度に変換
            })

        context = "\n".join(context_parts)

        # プロンプト作成
        if mode == "qa":
            # Q&Aモード
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", """あなたはMoodleのLMS（学習管理システム）の学習支援AIアシスタントです。
以下のコース教材の内容を参考に、学習者の質問に日本語で丁寧に答えてください。

# 教材コンテンツ:
{context}

# 回答のガイドライン:
- 提供されたコンテンツに基づいて正確に答える
- コンテンツに情報がない場合は「提供されたコンテンツにその情報は含まれていません」と伝える
- 具体例を挙げて分かりやすく説明する
- 学習者が理解しやすいよう丁寧な言葉遣いを心がける"""),
                ("human", "{question}")
            ])

            chain = prompt_template | llm
            response = chain.invoke({
                "context": context,
                "question": request.query
            })

        else:
            # 要約モード
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", """あなたはMoodleのLMS（学習管理システム）の学習支援AIアシスタントです。
以下のコース教材の内容を簡潔に要約してください。

# 教材コンテンツ:
{context}

# 要約のガイドライン:
- 重要なポイントを3〜5個の箇条書きでまとめる
- 各ポイントは具体的で分かりやすく書く
- 全体で300文字以内を目安にする
- 学習者が内容を把握しやすいよう整理する"""),
                ("human", "この教材の内容を要約してください。")
            ])

            chain = prompt_template | llm
            response = chain.invoke({"context": context})

        summary = response.content

        logger.info(f"Generated {mode} response: {len(summary)} characters")

        return SummarizeResponse(
            summary=summary,
            sources=sources,
            mode=mode
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in summarize_content: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/courses/{course_id}/modules")
async def get_course_modules(course_id: int):
    """コース内のモジュール一覧を取得"""
    if not collection:
        raise HTTPException(status_code=503, detail="Service not initialized")

    try:
        # コースIDでフィルタしてすべてのドキュメントを取得
        results = collection.get(
            where={"course_id": course_id},
            include=["metadatas"]
        )

        if not results['metadatas']:
            raise HTTPException(status_code=404, detail="Course not found")

        # モジュール名をユニークに抽出
        modules = {}
        for meta in results['metadatas']:
            module_name = meta.get('module_name', 'Unknown')
            if module_name not in modules:
                modules[module_name] = {
                    "name": module_name,
                    "section": meta.get('section_name', ''),
                    "type": meta.get('module_type', ''),
                    "filename": meta.get('filename', '')
                }

        return {
            "course_id": course_id,
            "modules": list(modules.values())
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_course_modules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv('PORT', 8001))
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
