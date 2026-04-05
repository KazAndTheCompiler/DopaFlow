from __future__ import annotations


def test_nutrition_food_library_seeds_presets(client) -> None:
    response = client.get("/api/v2/nutrition/foods")

    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert {"Coffee", "Tea", "Water", "Basic sandwich"}.issubset(names)


def test_nutrition_preset_foods_cannot_be_deleted(client) -> None:
    foods = client.get("/api/v2/nutrition/foods")
    preset = next(item for item in foods.json() if item["is_preset"] is True)

    response = client.delete(f"/api/v2/nutrition/foods/{preset['id']}")

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot delete preset food items"


def test_nutrition_user_foods_can_be_deleted(client) -> None:
    created = client.post(
        "/api/v2/nutrition/foods",
        json={"name": "Custom oats", "kj": 420, "protein_g": 14, "carbs_g": 52, "fat_g": 8, "unit": "bowl"},
    )
    food_id = created.json()["id"]

    deleted = client.delete(f"/api/v2/nutrition/foods/{food_id}")

    assert deleted.status_code == 204
    foods = client.get("/api/v2/nutrition/foods").json()
    assert all(item["id"] != food_id for item in foods)


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
