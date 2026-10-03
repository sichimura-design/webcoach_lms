"""
教材のキーワード検索 (keyword_search.py / vector_db.KeywordRetriever / faiss_ingestのkeywordモード)

埋め込みモデル(torch)を使わずに、日本語の質問で関係する教材だけを拾えること。
"""
import json
from unittest.mock import MagicMock, patch

import pytest

import agents.learning_coach_agent as agent
from keyword_search import KeywordIndex, content_tokens, tokenize

DOCS = [
    "Canvaのアカウントを作成して初期設定を完了する。アカウントの作り方: canva.comのトップページ右上の「登録」ボタンからメールアドレスで登録する方法が一番簡単です。",
    "Canvaは動画編集・SNS運用・マーケティングの武器になる。テンプレートを使えばバナーもリール動画も短時間で作れます。",
    "無料版とCanva Proの違い。Proではブランドキットや背景リムーバが使え、素材も増えます。",
    "ポートフォリオの作り方。作品ごとに目的・工夫・成果を書き、クライアントに見せられる形にまとめます。",
    "AIツールを使ったデザイン作成。画像生成AIでラフを作り、デザインツールで仕上げます。",
]


@pytest.fixture
def index():
    return KeywordIndex(DOCS, [{"filename": f"d{i}"} for i in range(len(DOCS))])


def _best(index, query):
    result = index.search(query, n_results=1)
    if not result["documents"][0]:
        return None, 0.0
    return result["documents"][0][0], 1 - result["distances"][0][0]


def test_tokenize_normalizes_and_makes_bigrams():
    # 全角英字はNFKCで半角・小文字に、全角スペースは区切りになる
    assert tokenize("Ｃａｎｖａ　の登録") == ["ca", "an", "nv", "va", "の登", "登録"]


def test_content_tokens_drop_hiragana_only_bigrams():
    tokens = content_tokens("登録方法を教えてください")
    assert "登録" in tokens and "方法" in tokens
    assert "えて" not in tokens and "ださ" not in tokens


@pytest.mark.parametrize("query, expected_doc", [
    ("Canvaのアカウントを作る方法を教えて", 0),
    ("Canvaは動画編集にも使えますか", 1),
    ("Canvaの無料版とProの違いは？", 2),
    ("ポートフォリオはどう作る？", 3),
])
def test_related_questions_find_the_right_material_above_floor(index, query, expected_doc):
    doc, relevance = _best(index, query)
    assert doc == DOCS[expected_doc]
    assert relevance >= agent.RAG_MIN_SIMILARITY


@pytest.mark.parametrize("query", [
    "面接の練習をしたい",
    "キャッチコピーを考えてほしい",
    "3時間（スピードを意識したい人向け）",
    "こんにちは",
])
def test_unrelated_questions_stay_below_floor(index, query):
    _, relevance = _best(index, query)
    assert relevance < agent.RAG_MIN_SIMILARITY


def test_course_filter_and_empty_query(index):
    assert index.search("Canva", course_id=99)["documents"] == [[]]
    assert index.search("です。", n_results=3)["documents"] == [[]]


def test_keyword_retriever_loads_metadata_from_s3():
    from vector_db import KeywordRetriever

    body = json.dumps({"documents": DOCS, "metadatas": [{} for _ in DOCS]}).encode()
    s3 = MagicMock()
    s3.get_object.return_value = {"Body": MagicMock(read=MagicMock(return_value=body))}
    with patch("boto3.client", return_value=s3):
        retriever = KeywordRetriever(s3_bucket="bucket", s3_prefix="vector_db/")

    s3.get_object.assert_called_once_with(Bucket="bucket", Key="vector_db/metadata.json")
    assert retriever.get_document_count() == len(DOCS)
    assert retriever.search("Canvaの無料版とProの違い", n_results=1)["documents"][0] == [DOCS[2]]


def test_ingest_in_keyword_mode_uploads_only_metadata(tmp_path, monkeypatch):
    """keywordモードの取り込みは埋め込みを作らず、metadata.jsonだけを更新する"""
    import routers.faiss_ingest as ingest

    monkeypatch.setenv("VECTOR_DB_ENV", "keyword")
    monkeypatch.setenv("S3_BUCKET_NAME", "bucket")
    monkeypatch.setenv("FAISS_CACHE_DIR", str(tmp_path))

    def download(bucket, key, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"documents": ["既存"], "metadatas": [{}]}, f)

    s3 = MagicMock()
    s3.download_file.side_effect = download
    with patch.object(ingest.boto3, "client", return_value=s3):
        manager = ingest.FAISSManager()
        manager.add_documents(["新しい教材"], [{"filename": "new.html"}])
        manager.save_and_upload()
        stats = manager.get_stats()

    assert manager.embedder is None
    uploaded_keys = [c.args[2] for c in s3.upload_file.call_args_list]
    assert uploaded_keys == ["vector_db/metadata.json"]
    saved = json.loads((tmp_path / "metadata.json").read_text(encoding="utf-8"))
    assert saved["documents"] == ["既存", "新しい教材"]
    assert saved["embedding_model"] is None
    assert stats["total_documents"] == 2


def _rebuild(tmp_path, monkeypatch, existing, modules, pages, **request_kwargs):
    """Moodle教材からの再構築を、DB・HTTP・S3をモックして実行し、保存されたmetadata.jsonを返す"""
    import routers.faiss_ingest as ingest

    monkeypatch.setenv("VECTOR_DB_ENV", "keyword")
    monkeypatch.setenv("S3_BUCKET_NAME", "bucket")
    monkeypatch.setenv("FAISS_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(ingest, "_faiss_manager", None)

    def download(bucket, key, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(existing, f)

    def fetch(url):
        if url not in pages:
            raise RuntimeError("404")
        return pages[url]

    uploaded = {}

    def upload(path, bucket, key):
        with open(path, encoding="utf-8") as f:
            uploaded[key] = json.load(f)

    s3 = MagicMock()
    s3.download_file.side_effect = download
    s3.upload_file.side_effect = upload
    with patch.object(ingest.boto3, "client", return_value=s3), \
            patch.object(ingest, "fetch_moodle_material_modules", return_value=modules), \
            patch.object(ingest, "_fetch_material_text", side_effect=fetch), \
            patch.object(agent, "reload_vector_db") as reload_chat:
        response = ingest.rebuild_from_moodle_materials(ingest.MoodleMaterialsRebuildRequest(**request_kwargs))

    reload_chat.assert_called_once()
    return response, uploaded["vector_db/metadata.json"]


def _module(cmid, course_id, url, lesson="レッスン"):
    return {"cmid": cmid, "course_id": course_id, "course_name": f"コース{course_id}",
            "section_no": 1, "section_name": "章1", "lesson_name": lesson, "url": url}


def test_rebuild_from_moodle_replaces_index_with_course_ids(tmp_path, monkeypatch):
    """古い索引(course_id無し)は捨て、Moodleのコース単位でcourse_idつきのチャンクを作る。
    同じHTMLが2コースにあれば取得は1回、チャンクはコースごとに作る"""
    existing = {"documents": ["古いCanva"], "metadatas": [{"filename": "old.html"}]}
    modules = [
        _module(1, 23, "https://x/materials/a.html", "Canvaの登録"),
        _module(2, 69, "https://x/materials/a.html", "Canvaの登録"),
        _module(3, 69, "https://x/materials/missing.html"),
    ]
    pages = {"https://x/materials/a.html": "Canvaのアカウントを作成する"}

    response, saved = _rebuild(tmp_path, monkeypatch, existing, modules, pages)

    assert saved["documents"] == ["Canvaのアカウントを作成する"] * 2
    assert [m["course_id"] for m in saved["metadatas"]] == [23, 69]
    assert saved["metadatas"][0]["module_name"] == "Canvaの登録"
    assert saved["metadatas"][0]["cmid"] == 1
    assert response.documents_added == 2
    assert response.success is False  # 取得できなかった教材はerrorsに出す
    assert any("missing.html" in e for e in response.errors)


def test_rebuild_for_specific_courses_keeps_other_courses(tmp_path, monkeypatch):
    existing = {
        "documents": ["コース23の古い教材", "コース50の教材"],
        "metadatas": [{"course_id": 23}, {"course_id": 50}],
    }
    modules = [_module(1, 23, "https://x/materials/a.html")]
    pages = {"https://x/materials/a.html": "コース23の新しい教材"}

    response, saved = _rebuild(tmp_path, monkeypatch, existing, modules, pages, course_ids=[23])

    assert saved["documents"] == ["コース50の教材", "コース23の新しい教材"]
    assert response.success is True


def test_keyword_search_filters_by_course_after_rebuild():
    index = KeywordIndex(
        ["Canvaのアカウントを作成する", "Canvaでバナーを作る"],
        [{"course_id": 23}, {"course_id": 69}],
    )
    result = index.search("Canvaのアカウント", course_id=69)
    assert result["documents"][0] == ["Canvaでバナーを作る"]


def test_rebuild_job_runs_in_background_and_reports_progress(monkeypatch):
    """管理画面用: 開始はすぐ返り、statusで進み具合と結果が見える。実行中の二重開始は409"""
    import threading as _threading
    import routers.faiss_ingest as ingest
    from fastapi import HTTPException

    release = _threading.Event()

    def fake_rebuild(request, progress):
        progress.update(phase='fetching', total_pages=2, fetched_pages=1)
        release.wait(5)
        return ingest.IngestResponse(success=True, message="ok", files_processed=2,
                                     documents_added=3, faiss_total_vectors=3)

    monkeypatch.setattr(ingest, "_rebuild_job", {'status': 'idle'})
    monkeypatch.setattr(ingest, "_rebuild_from_moodle_materials", fake_rebuild)

    started = ingest.start_rebuild_from_moodle_materials(ingest.MoodleMaterialsRebuildRequest())
    assert started["status"] == "running"
    with pytest.raises(HTTPException) as exc:
        ingest.start_rebuild_from_moodle_materials(ingest.MoodleMaterialsRebuildRequest())
    assert exc.value.status_code == 409

    release.set()
    for _ in range(100):
        if ingest.get_rebuild_from_moodle_materials_status()["status"] != "running":
            break
        _threading.Event().wait(0.02)
    done = ingest.get_rebuild_from_moodle_materials_status()
    assert done["status"] == "succeeded"
    assert done["fetched_pages"] == 1
    assert done["result"]["documents_added"] == 3
