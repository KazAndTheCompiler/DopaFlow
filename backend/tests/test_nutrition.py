from __future__ import annotations


def test_nutrition_log_and_today_summary(client) -> None:
    create = client.post(
        "/api/v2/nutrition/log",
        json={"name": "Eggs", "kj": 320, "protein_g": 24, "carbs_g": 2, "fat_g": 20},
    )

    assert create.status_code == 200

    response = client.get("/api/v2/nutrition/today")

    assert response.status_code == 200
    body = response.json()
    assert body["total_kj"] >= 320
    assert len(body["entries"]) == 1


def test_nutrition_recent_returns_logged_items(client) -> None:
    client.post(
        "/api/v2/nutrition/log",
        json={"name": "Yogurt", "kj": 150, "protein_g": 10, "carbs_g": 12, "fat_g": 5},
    )

    response = client.get("/api/v2/nutrition/recent")

    assert response.status_code == 200
    assert any(item["name"] == "Yogurt" for item in response.json())
