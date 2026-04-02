from __future__ import annotations

from app.core.database import tx


def test_eisenhower_endpoint_groups_tasks(client, db_path) -> None:
    with tx(str(db_path)) as conn:
        conn.execute(
            """
            INSERT INTO tasks (id, title, priority, due_at, done)
            VALUES
              ('urgent-important', 'Bug fix', 1, datetime('now'), 0),
              ('important', 'Write design doc', 2, NULL, 0),
              ('delegate', 'Customer reply', 3, NULL, 0),
              ('eliminate', 'Busywork', 4, NULL, 0)
            """
        )

    response = client.get("/api/v2/boards/eisenhower")

    assert response.status_code == 200
    quadrants = response.json()
    assert "urgent-important" in [task["id"] for task in quadrants["q1"]]
    assert "important" in [task["id"] for task in quadrants["q2"]]
    assert "delegate" in [task["id"] for task in quadrants["q3"]]
    assert "eliminate" in [task["id"] for task in quadrants["q4"]]


def test_matrix_data_returns_all_quadrants(client) -> None:
    response = client.get("/api/v2/boards/matrix-data")

    assert response.status_code == 200
    matrix = response.json()
    assert set(matrix) == {"do", "schedule", "delegate", "eliminate"}
