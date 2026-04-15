"""OIDC auth router: token, userinfo, revoke endpoints (prefixed /api/v2/auth)."""

from __future__ import annotations

import base64

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings_dependency
from app.domains.auth.schemas import (
    ClientCreate,
    ClientList,
    ClientRead,
    RevokeRequest,
    RevokeResponse,
    TokenIntrospectionRequest,
    TokenIntrospectionResponse,
    TokenRequest,
    TokenResponse,
    UserCreate,
    UserInfo,
    UserList,
    UserRead,
    UserReadFull,
)
from app.domains.auth.service import AuthService, get_auth_service
from app.middleware.auth_scopes import require_scope, verify_scope_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/token", response_model=TokenResponse)
async def token(
    request: TokenRequest,
    svc: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    if request.grant_type == "authorization_code":
        result = svc.exchange_code(
            code=request.code,
            code_verifier=request.code_verifier,
            client_id=request.client_id,
            redirect_uri=request.redirect_uri,
            state=request.state,
        )
    elif request.grant_type == "refresh_token":
        result = svc.refresh_access_token(refresh_token=request.refresh_token)
    else:
        raise HTTPException(status_code=400, detail="Unsupported grant_type")
    return TokenResponse(**result)


@router.get("/userinfo", response_model=UserInfo)
async def userinfo(
    authorization: str | None = Query(default=None),
    svc: AuthService = Depends(get_auth_service),
) -> UserInfo:
    if not authorization:
        raise HTTPException(status_code=401, detail="missing_token")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="invalid_token")
    try:
        verify_scope_token(token.strip())
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")
    info = svc.get_userinfo(token.strip())
    return UserInfo(**info)


@router.post("/revoke", response_model=RevokeResponse)
async def revoke(
    request: RevokeRequest,
    authorization: str | None = Query(default=None),
    svc: AuthService = Depends(get_auth_service),
) -> RevokeResponse:
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            try:
                verify_scope_token(token)
            except Exception:
                pass
    svc.revoke_token(request.token, token_hint=request.token_hint)
    return RevokeResponse(revoked=True)


@router.get("/jwks")
async def jwks(settings: Settings = Depends(get_settings_dependency)) -> dict:
    secret = settings.auth_token_secret or settings.api_key or "insecure-dev-secret"
    return {
        "keys": [
            {
                "kty": "oct",
                "use": "sig",
                "alg": "HS256",
                "k": base64.urlsafe_b64encode(secret.encode()).rstrip(b"=").decode(),
            }
        ]
    }


@router.post(
    "/users",
    response_model=UserRead,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def create_user(
    payload: UserCreate,
    svc: AuthService = Depends(get_auth_service),
) -> UserRead:
    user = svc.create_user(
        email=payload.email,
        password=payload.password,
        role=payload.role,
    )
    return UserRead(id=user["id"], email=user["email"], role=user["role"])


@router.get(
    "/users",
    response_model=UserList,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def list_users(
    svc: AuthService = Depends(get_auth_service),
) -> UserList:
    users = svc.list_users()
    return UserList(
        users=[
            UserReadFull(
                id=u["id"],
                email=u["email"],
                role=u["role"],
                created_at=u.get("created_at"),
            )
            for u in users
        ]
    )


@router.get("/roles")
async def list_roles() -> dict:
    from app.domains.auth.service import ROLE_SCOPES

    return {"roles": dict(ROLE_SCOPES)}


@router.post("/introspect", response_model=TokenIntrospectionResponse)
async def introspect(
    request: TokenIntrospectionRequest,
    authorization: str | None = Query(default=None),
    svc: AuthService = Depends(get_auth_service),
) -> TokenIntrospectionResponse:
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            try:
                verify_scope_token(token)
            except Exception:
                pass
    result = svc.introspect_token(request.token)
    return TokenIntrospectionResponse(**result)


@router.post(
    "/clients",
    response_model=ClientRead,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def create_client(
    payload: ClientCreate,
    svc: AuthService = Depends(get_auth_service),
) -> ClientRead:
    client = svc.create_client(
        client_id=payload.client_id,
        client_name=payload.client_name,
        redirect_uri=payload.redirect_uri,
        scope=payload.scope,
        pkce_required=payload.pkce_required,
    )
    return ClientRead(
        client_id=client["client_id"],
        client_secret=client.get("client_secret"),
        client_name=client["client_name"],
        redirect_uri=client["redirect_uri"],
        scope=client["scope"],
        pkce_required=client["pkce_required"],
    )


@router.get(
    "/clients",
    response_model=ClientList,
    dependencies=[Depends(require_scope("admin:ops"))],
)
async def list_clients(
    svc: AuthService = Depends(get_auth_service),
) -> ClientList:
    clients = svc.list_clients()
    return ClientList(
        clients=[
            ClientRead(
                client_id=c["client_id"],
                client_secret=None,
                client_name=c["client_name"],
                redirect_uri=c["redirect_uri"],
                scope=c["scope"],
                pkce_required=c["pkce_required"],
            )
            for c in clients
        ]
    )
