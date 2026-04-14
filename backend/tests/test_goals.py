from __future__ import annotations


def create_goal(client, **overrides):
    payload = {
        "title": "Ship DopaFlow",
        "description": "Get the release stable",
        "horizon": "quarter",
        "milestone_labels": ["Fix release", "Verify routes"],
    }
    payload.update(overrides)
    response = client.post("/api/v2/goals/", json=payload)
    assert response.status_code == 200
    return response.json()


def test_create_goal_returns_milestones(client) -> None:
    goal = create_goal(client)

    assert goal["title"] == "Ship DopaFlow"
    assert len(goal["milestones"]) == 2
    assert goal["done"] is False


def test_list_goals_returns_created_goal(client) -> None:
    goal = create_goal(client, title="Stabilize app")

    response = client.get("/api/v2/goals/")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [goal["id"]]


def test_complete_final_milestone_marks_goal_done(client) -> None:
    goal = create_goal(client)

    first = client.post(
        f"/api/v2/goals/{goal['id']}/milestones/{goal['milestones'][0]['id']}/complete"
    )
    second = client.post(
        f"/api/v2/goals/{goal['id']}/milestones/{goal['milestones'][1]['id']}/complete"
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["done"] is True
    assert all(milestone["done"] for milestone in second.json()["milestones"])


def test_add_milestone_resets_done_state(client) -> None:
    goal = create_goal(client, milestone_labels=["Only one"])
    client.post(
        f"/api/v2/goals/{goal['id']}/milestones/{goal['milestones'][0]['id']}/complete"
    )

    response = client.post(
        f"/api/v2/goals/{goal['id']}/milestones", json={"label": "Polish UX"}
    )

    assert response.status_code == 200
    assert response.json()["done"] is False
    assert [milestone["label"] for milestone in response.json()["milestones"]] == [
        "Only one",
        "Polish UX",
    ]


def test_delete_goal_removes_it(client) -> None:
    goal = create_goal(client)

    delete_response = client.delete(f"/api/v2/goals/{goal['id']}")
    list_response = client.get("/api/v2/goals/")

    assert delete_response.status_code == 200
    assert delete_response.json() == {"ok": True}
    assert list_response.json() == []
