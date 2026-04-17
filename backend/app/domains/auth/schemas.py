"""Pydantic schemas for the OIDC auth domain."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class OIDCDiscovery(BaseModel):
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    revocation_endpoint: str
    jwks_uri: str
    response_types_supported: list[str]
    grant_types_supported: list[str]
    subject_types_supported: list[str]
    id_token_signing_alg_values_supported: list[str]
    scopes_supported: list[str]
    token_endpoint_auth_methods_supported: list[str]
    code_challenge_methods_supported: list[str]
    claims_supported: list[str]


class AuthorizeQuery(BaseModel):
    response_type: Literal["code"]
    client_id: str = Field(min_length=1, max_length=256)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    scope: str = Field(default="openid profile email", max_length=1024)
    state: str = Field(min_length=16, max_length=256)
    code_challenge: str = Field(min_length=43, max_length=128)
    code_challenge_method: Literal["S256"] = "S256"

    @field_validator("code_challenge")
    @classmethod
    def validate_code_challenge(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("code_challenge must be base64url alphanumeric")
        return v


class TokenRequest(BaseModel):
    grant_type: Literal["authorization_code", "refresh_token"]
    code: str | None = Field(default=None, max_length=256)
    redirect_uri: str | None = Field(default=None, max_length=2048)
    client_id: str | None = Field(default=None, max_length=256)
    code_verifier: str | None = Field(default=None, max_length=128)
    refresh_token: str | None = Field(default=None, max_length=256)
    state: str | None = Field(default=None, max_length=256)

    @model_validator(mode="after")
    def check_auth_code_grant(self) -> TokenRequest:
        if self.grant_type == "authorization_code":
            if not self.code or not self.redirect_uri or not self.client_id:
                raise ValueError(
                    "code, redirect_uri, and client_id are required for authorization_code grant"
                )
            if not self.code_verifier:
                raise ValueError(
                    "code_verifier is required for authorization_code grant"
                )
        elif self.grant_type == "refresh_token":
            if not self.refresh_token:
                raise ValueError("refresh_token is required for refresh_token grant")
        return self


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: str
    scope: str
    id_token: str | None = None


class UserInfo(BaseModel):
    sub: str
    email: str | None = None
    email_verified: bool | None = None
    name: str | None = None
    preferred_username: str | None = None
    role: str | None = None


class RevokeRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    token_hint: Literal["access_token", "refresh_token"] | None = None


class RevokeResponse(BaseModel):
    revoked: bool


class UserCreate(BaseModel):
    email: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=8, max_length=256)
    role: str = Field(default="viewer")


class UserRead(BaseModel):
    id: str
    email: str
    role: str


class UserReadFull(BaseModel):
    id: str
    email: str
    role: str
    created_at: str | None = None


class UserList(BaseModel):
    users: list[UserReadFull]


class TokenIntrospectionRequest(BaseModel):
    token: str = Field(min_length=1)
    token_hint: Literal["access_token", "refresh_token"] | None = None


class TokenIntrospectionResponse(BaseModel):
    active: bool
    sub: str | None = None
    email: str | None = None
    role: str | None = None
    scope: str | None = None
    client_id: str | None = None
    exp: int | None = None
    iat: int | None = None
    token_type: str | None = None


class ClientCreate(BaseModel):
    client_id: str = Field(min_length=1, max_length=128)
    client_name: str = Field(min_length=1, max_length=256)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    scope: str = Field(default="openid profile email", max_length=1024)
    pkce_required: bool = Field(default=True)


class ClientRead(BaseModel):
    client_id: str
    client_secret: str | None = None
    client_name: str
    redirect_uri: str
    scope: str
    pkce_required: bool


class ClientList(BaseModel):
    clients: list[ClientRead]
