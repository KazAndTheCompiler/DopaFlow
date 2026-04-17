"""External OIDC auth router: provider list, login redirect, callback."""

from __future__ import annotations

import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.core.config import Settings, get_settings_dependency
from app.domains.auth.oidc import generate_code_challenge
from app.domains.auth.oidc_external import consume_oidc_state, create_oidc_state
from app.domains.auth.schemas import OIDCProviderList, OIDCProviderRead
from app.domains.auth.service import AuthService, get_auth_service
from app.services.oidc_provider import (
    fetch_discovery,
    fetch_jwks,
    validate_id_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oidc", tags=["auth-oidc"])


@router.get("/providers", response_model=OIDCProviderList)
async def list_providers(
    svc: AuthService = Depends(get_auth_service),
):
    """Return enabled external OIDC providers."""
    providers = svc.get_enabled_providers()
    return OIDCProviderList(
        providers=[
            OIDCProviderRead(
                name=p["name"],
                issuer_url=p["issuer_url"],
                scopes=p["scopes"],
                default_role=p["default_role"],
            )
            for p in providers
        ]
    )


@router.get("/login/{provider_name}")
async def oidc_login(
    provider_name: str,
    client_id: str = Query(..., min_length=1, max_length=256),
    redirect_uri: str = Query(..., min_length=1, max_length=2048),
    scope: str = Query(default="openid profile email", max_length=1024),
    state: str = Query(..., min_length=16, max_length=256),
    code_challenge: str = Query(..., min_length=43, max_length=128),
    code_challenge_method: str = Query(default="S256"),
    settings: Settings = Depends(get_settings_dependency),
    svc: AuthService = Depends(get_auth_service),
):
    """Initiate an external OIDC login flow."""
    if code_challenge_method != "S256":
        raise HTTPException(status_code=400, detail="code_challenge_method must be S256")

    provider = svc.get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=404, detail=f"OIDC provider '{provider_name}' not found")

    # Fetch discovery from the external IdP
    try:
        discovery = await fetch_discovery(provider["issuer_url"])
    except Exception as exc:
        logger.error("Failed to fetch OIDC discovery for %s: %s", provider_name, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach OIDC provider '{provider_name}'. Try again later.",
        ) from exc

    auth_endpoint = discovery.get("authorization_endpoint")
    if not auth_endpoint:
        raise HTTPException(status_code=502, detail="Provider discovery missing authorization_endpoint")

    # Build our callback URL
    callback_url = f"{settings.base_url.rstrip('/')}/api/v2/auth/oidc/callback/{provider_name}"

    # Create state and PKCE for the external IdP exchange
    external_state, external_code_verifier = create_oidc_state(
        provider_name=provider_name,
        redirect_uri=redirect_uri,
        scope=scope,
        client_id=client_id,
        original_state=state,
        code_challenge=code_challenge,
        settings=settings,
    )

    external_code_challenge = generate_code_challenge(external_code_verifier)

    params = {
        "client_id": provider["client_id"],
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": provider.get("scopes", "openid profile email"),
        "state": external_state,
        "code_challenge": external_code_challenge,
        "code_challenge_method": "S256",
    }

    separator = "&" if "?" in auth_endpoint else "?"
    redirect_url = f"{auth_endpoint}{separator}{urlencode(params)}"
    return RedirectResponse(url=redirect_url, status_code=302)


@router.get("/callback/{provider_name}")
async def oidc_callback(
    provider_name: str,
    code: str = Query(..., min_length=1),
    state: str = Query(..., min_length=1),
    settings: Settings = Depends(get_settings_dependency),
    svc: AuthService = Depends(get_auth_service),
):
    """Handle the external IdP redirect after user authentication."""
    # 1. Consume the state (one-time use)
    stored = consume_oidc_state(state, settings.db_path)
    if not stored:
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")

    provider = svc.get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=404, detail=f"OIDC provider '{provider_name}' not found")

    # 2. Fetch discovery and JWKS
    try:
        discovery = await fetch_discovery(provider["issuer_url"])
    except Exception as exc:
        logger.error("Failed to fetch OIDC discovery in callback: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach OIDC provider") from exc

    jwks_uri = discovery.get("jwks_uri")
    token_endpoint = discovery.get("token_endpoint")
    if not token_endpoint:
        raise HTTPException(status_code=502, detail="Provider discovery missing token_endpoint")

    # 3. Exchange code with external IdP
    callback_url = f"{settings.base_url.rstrip('/')}/api/v2/auth/oidc/callback/{provider_name}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(
            token_endpoint,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": callback_url,
                "client_id": provider["client_id"],
                "client_secret": provider["client_secret"],
                "code_verifier": stored["code_verifier"],
            },
            headers={"Accept": "application/json"},
        )
    if token_resp.status_code != 200:
        logger.error("Token exchange failed: %s %s", token_resp.status_code, token_resp.text[:200])
        raise HTTPException(status_code=502, detail="Token exchange with OIDC provider failed")

    tokens = token_resp.json()
    id_token_str = tokens.get("id_token")
    if not id_token_str:
        raise HTTPException(status_code=502, detail="No id_token in provider response")

    # 4. Validate the ID token
    try:
        if jwks_uri:
            jwks = await fetch_jwks(jwks_uri)
        else:
            jwks = {"keys": []}
        claims = validate_id_token(
            id_token=id_token_str,
            issuer=provider["issuer_url"],
            client_id=provider["client_id"],
            jwks=jwks,
        )
    except ValueError as exc:
        logger.error("ID token validation failed: %s", exc)
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    # 5. Create or link the local user
    subject = claims.get("sub")
    email = claims.get("email", "")
    if not subject:
        raise HTTPException(status_code=401, detail="ID token missing 'sub' claim")

    user = svc.get_or_create_user_by_oidc(
        issuer=provider["issuer_url"],
        subject=subject,
        email=email,
        default_role=provider.get("default_role", "viewer"),
    )

    # 6. Issue a DopaFlow auth code (same as password login)
    auth_code = svc.create_auth_code(
        client_id=stored["client_id"],
        redirect_uri=stored["redirect_uri"],
        code_verifier=stored["code_challenge"],
        scope=stored["scope"],
        user_id=user["id"],
        email=user["email"],
        state=stored["original_state"],
    )

    # 7. Redirect to the original client's redirect_uri
    redirect_uri = stored["redirect_uri"]
    original_state = stored["original_state"]
    separator = "&" if "?" in redirect_uri else "?"
    return RedirectResponse(
        url=f"{redirect_uri}{separator}code={auth_code}&state={original_state}",
        status_code=302,
    )
