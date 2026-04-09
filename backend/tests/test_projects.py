from __future__ import annotations


def create_project(client, **overrides):
    payload = {
        "name": "Core",
        "color": "#22c55e",
        "icon": "C",
        "sort_order": 1,
    }
    payload.update(overrides)
    response = client.post("/api/v2/projects/", json=payload)
    assert response.status_code == 200
    return response.json()


def test_create_project_returns_contract_shape(client) -> None:
    project = create_project(client)

    assert project["id"].startswith("prj_")
    assert project["name"] == "Core"
    assert project["archived"] is False
    assert "created_at" in project
    assert "updated_at" in project


def test_list_projects_returns_created_project(client) -> None:
    project = create_project(client, name="Frontend")

    response = client.get("/api/v2/projects/")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [project["id"]]


def test_patch_project_updates_archived_state(client) -> None:
    project = create_project(client)

    response = client.patch(f"/api/v2/projects/{project['id']}", json={"archived": True})

    assert response.status_code == 200
    assert response.json()["archived"] is True


def test_delete_project_returns_deleted_ack(client) -> None:
    project = create_project(client)

    delete_response = client.delete(f"/api/v2/projects/{project['id']}")
    list_response = client.get("/api/v2/projects/")

    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True}
    assert list_response.json() == []


def test_task_counts_returns_project_id_mapping(client) -> None:
    project = create_project(client)
    client.post("/api/v2/tasks/", json={"title": "Wire router", "project_id": project["id"]})

    response = client.get("/api/v2/projects/task-counts")

    assert response.status_code == 200
    assert response.json() == {project["id"]: 1}
