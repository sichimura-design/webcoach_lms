"""
POST /api/image-url/{category_id}/{target_id} の保存結果

コース編集でサムネURLを送ると、保存はできているのに返事を作る所で
created_at/updated_at が無く500になっていた(本番 course 77)。
"""


def test_upsert_course_image_url_returns_200_and_saves(client):
    url = "https://study.webcoach.jp/images/courses/wix.webp"

    res = client.post("/api/image-url/1/77", json={"image_url": url})

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["image_url"] == url
    assert body["created_at"] is not None

    got = client.get("/api/image-url/1/77")
    assert got.json()["image_url"] == url


def test_upsert_course_image_url_updates_existing_row(client):
    client.post("/api/image-url/1/77", json={"image_url": "https://example.com/old.webp"})

    res = client.post("/api/image-url/1/77", json={"image_url": "https://example.com/new.webp"})

    assert res.status_code == 200, res.text
    assert client.get("/api/image-url/1/77").json()["image_url"] == "https://example.com/new.webp"
