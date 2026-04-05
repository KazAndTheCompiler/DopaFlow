# ENDPOINTS
#   POST   /gmail/connect
#   POST   /gmail/import
#   GET    /gmail/callback
#   POST   /github/import-issues
#   POST   /webhooks/outbox
#   GET    /outbox/metrics
#   POST   /outbox/dispatch

"""API router for the integrations domain."""

from __future__ import annotations

import datetime
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.core.config import Settings, get_settings_dependency
from app.domains.integrations.repository import IntegrationsRepository
from app.domains.integrations.schemas import GmailConnectRequest, GmailImportResult, IntegrationsStatus, WebhookDispatch
from app.domains.integrations.service import dispatch_once, snapshot_metrics
from app.middleware.auth_scopes import require_scope

router = APIRouter(tags=["integrations"])


async def _repo(settings: Settings = Depends(get_settings_dependency)) -> IntegrationsRepository:
    return IntegrationsRepository(settings.db_path, settings=settings)


@router.post("/gmail/connect", response_model=dict, dependencies=[Depends(require_scope("write:integrations"))])
async def connect_gmail(payload: GmailConnectRequest, repo: IntegrationsRepository = Depends(_repo)) -> dict[str, object]:
    return repo.connect_gmail(payload)


@router.post("/gmail/import", response_model=GmailImportResult, dependencies=[Depends(require_scope("write:integrations"))])
async def import_gmail_tasks(repo: IntegrationsRepository = Depends(_repo)) -> GmailImportResult:
    return repo.import_gmail_tasks_real()


@router.get("/gmail/callback", response_model=dict, dependencies=[Depends(require_scope("write:integrations"))])
async def gmail_oauth_callback(
    code: str,
    settings: Settings = Depends(get_settings_dependency),
    repo: IntegrationsRepository = Depends(_repo),
) -> dict[str, object]:
    if not settings.google_client_id or not settings.google_client_secret:
        return {"status": "error", "message": "Google credentials not configured"}
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": f"{settings.base_url}/api/v2/integrations/gmail/callback",
                "grant_type": "authorization_code",
            },
        )
    if response.status_code != 200:
        return {"status": "error", "message": "Token exchange failed"}
    data = response.json()
    expires_at = (
        datetime.datetime.utcnow() + datetime.timedelta(seconds=int(data.get("expires_in", 3600)))
    ).isoformat()
    repo.store_token("gmail", data["access_token"], data.get("refresh_token"), expires_at, data.get("scope", ""))
    return {"status": "connected"}


@router.post("/github/import-issues", response_model=dict, dependencies=[Depends(require_scope("write:integrations"))])
async def import_github_issues(
    payload: dict[str, Any],
    settings: Settings = Depends(get_settings_dependency),
) -> dict[str, Any]:
    """Import GitHub issues as tasks using a Personal Access Token."""
    token = payload.get("token", "")
    repo = payload.get("repo", "")  # format: "owner/repo"
    state = payload.get("state", "open")  # "open", "closed", "all"

    if not token or not repo:
        raise HTTPException(status_code=422, detail="token and repo are required")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo}/issues",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            params={"state": state, "per_page": 100},
            timeout=15,
        )
    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid GitHub token")
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Repository not found")
    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {resp.status_code}")

    from app.domains.tasks import repository as tasks_repo
    issues = resp.json()
    created = 0
    skipped = 0
    for issue in issues:
        if issue.get("pull_request"):
            skipped += 1
            continue
        external_id = f"github_issue_{issue['number']}"
        existing = tasks_repo.list_tasks(settings.db_path, search=None)
        if any(t.get("source_external_id") == external_id for t in existing):
            skipped += 1
            continue
        tasks_repo.create_task(settings.db_path, {
            "title": issue["title"],
            "description": issue.get("body") or "",
            "source_type": "github",
            "source_external_id": external_id,
            "tags": [label["name"] for label in issue.get("labels", [])],
            "priority": 3,
        })
        created += 1

    return {"created": created, "skipped": skipped, "repo": repo}


@router.get("/status", response_model=IntegrationsStatus, dependencies=[Depends(require_scope("read:integrations"))])
async def integrations_status(repo: IntegrationsRepository = Depends(_repo)) -> IntegrationsStatus:
    return repo.get_status()


@router.post("/webhooks/outbox", response_model=dict, dependencies=[Depends(require_scope("write:integrations"))])
async def enqueue_webhook(payload: WebhookDispatch, repo: IntegrationsRepository = Depends(_repo)) -> dict[str, object]:
    return repo.enqueue_webhook(payload)


@router.get("/outbox/metrics", response_model=dict, dependencies=[Depends(require_scope("read:integrations"))])
async def outbox_metrics(settings: Settings = Depends(get_settings_dependency)) -> dict[str, int]:
    return snapshot_metrics(settings.db_path)


@router.post("/outbox/dispatch", response_model=dict, dependencies=[Depends(require_scope("write:integrations"))])
async def outbox_dispatch(settings: Settings = Depends(get_settings_dependency)) -> dict[str, int]:
    return dispatch_once(settings.db_path)
