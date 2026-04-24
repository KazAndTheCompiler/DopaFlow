"""OIDC auth router: token, userinfo, revoke endpoints (prefixed /api/v2/auth)."""

from __future__ import annotations

import base64
import hashlib
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query

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

logger = logging.getLogger("dopaflow.auth")


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
    authorization: str | None = Header(default=None, alias="Authorization"),
    svc: AuthService = Depends(get_auth_service),
) -> UserInfo:
    """Get user info from access token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="missing_token")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="invalid_token")
    try:
        verify_scope_token(token.strip())
    except Exception as exc:
        logger.debug("Token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="invalid_token")
    info = svc.get_userinfo(token.strip())
    return UserInfo(**info)


@router.post("/revoke", response_model=RevokeResponse)
async def revoke(
    request: RevokeRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    svc: AuthService = Depends(get_auth_service),
) -> RevokeResponse:
    """Revoke a token. Requires authentication to prevent unauthorized revocation."""
    # SECURITY FIX: Require valid authentication
    if not authorization:
        raise HTTPException(status_code=401, detail="missing_token")
    
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="invalid_token")
    
    # Verify the caller's token is valid
    try:
        caller_payload = verify_scope_token(token.strip())
    except Exception as exc:
        logger.warning("Token revocation attempted with invalid auth: %s", exc)
        raise HTTPException(status_code=401, detail="invalid_token")
    
    # Get the token to be revoked
    token_to_revoke = request.token
    
    # Try to introspect the token being revoked to check ownership
    try:
        target_payload = svc.introspect_token(token_to_revoke)
        target_user_id = target_payload.get("sub") if target_payload.get("active") else None
        
        # Only allow revoking own tokens or admin users
        caller_user_id = caller_payload.get("sub")
        caller_scopes = caller_payload.get("scopes", [])
        
        if target_user_id and target_user_id != caller_user_id and "admin:ops" not in caller_scopes:
            logger.warning(
                "User %s attempted to revoke token belonging to user %s",
                caller_user_id, target_user_id
            )
            raise HTTPException(status_code=403, detail="cannot_revoke_other_user_token")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error checking token ownership: %s", exc)
        # Continue with revocation attempt even if introspection fails
        pass
    
    svc.revoke_token(request.token, token_hint=request.token_hint)
    logger.info("Token revoked by user %s", caller_payload.get("sub"))
    return RevokeResponse(revoked=True)


@router.get("/jwks")
async def jwks(settings: Settings = Depends(get_settings_dependency)) -> dict:
    """JWKS endpoint - returns public key info only.

    SECURITY: Never expose symmetric secrets here. This endpoint only returns
    key metadata for verification purposes. Symmetric keys (HS256) must never
    be exposed via JWKS.
    """
    # SECURITY FIX: Do not expose the symmetric secret
    # For HS256, the secret must remain private. This endpoint only returns
    # public metadata. Token verification should use the configured secret.
    if settings.production:
        # In production, return empty keys or 404
        # Symmetric keys should not be distributed via JWKS
        raise HTTPException(
            status_code=404,
            detail="JWKS not available for symmetric key configuration"
        )

    # Dev-only: Return a placeholder that doesn't expose the actual secret
    # This prevents accidental token forgery in development
    return {
        "keys": [
            {
                "kty": "oct",
                "use": "sig",
                "alg": "HS256",
                # Return a hash of the secret, not the secret itself
                "kid": hashlib.sha256(
                    (settings.auth_token_secret or "dev").encode()
                ).hexdigest()[:16],
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
    authorization: str | None = Header(default=None, alias="Authorization"),
    svc: AuthService = Depends(get_auth_service),
) -> TokenIntrospectionResponse:
    """Introspect a token. Requires authentication to prevent token enumeration attacks."""
    # SECURITY FIX: Require authentication for introspection
    if not authorization:
        raise HTTPException(status_code=401, detail="missing_token")
    
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="invalid_token")
    
    # Verify the caller's token is valid
    try:
        caller_payload = verify_scope_token(token.strip())
    except Exception as exc:
        logger.warning("Token introspection attempted with invalid auth: %s", exc)
        raise HTTPException(status_code=401, detail="invalid_token")
    
    # Get the token being introspected
    result = svc.introspect_token(request.token)
    
    # SECURITY: Only allow introspecting own tokens or admin users
    target_user_id = result.get("sub") if result.get("active") else None
    caller_user_id = caller_payload.get("sub")
    caller_scopes = caller_payload.get("scopes", [])
    
    if target_user_id and target_user_id != caller_user_id and "admin:ops" not in caller_scopes:
        # Return inactive for other users' tokens (don't reveal if token exists)
        logger.warning(
            "User %s attempted to introspect token belonging to user %s",
            caller_user_id, target_user_id
        )
        return TokenIntrospectionResponse(active=False)
    
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
