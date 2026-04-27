import { API_BASE_URL } from "./client";

function generateCodeVerifier(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, length);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

const TOKEN_KEY = "dopaflow_access_token";
const REFRESH_KEY = "dopaflow_refresh_token";
const STATE_KEY = "dopaflow_auth_state";
const CODE_VERIFIER_KEY = "dopaflow_code_verifier";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  idToken?: string;
}

export interface User {
  sub: string;
  email: string;
  role: string;
}

function base64urlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

export function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = base64urlDecode(parts[1]);
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const stored = sessionStorage.getItem(TOKEN_KEY);
  if (!stored) {
    return null;
  }
  const parsed = parseJwt(stored);
  if (!parsed) {
    clearTokens();
    return null;
  }
  const exp = (parsed.exp as number) * 1000;
  if (Date.now() >= exp) {
    await tryRefresh();
    return sessionStorage.getItem(TOKEN_KEY);
  }
  return stored;
}

export async function getUser(): Promise<User | null> {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }
  const res = await fetch(`${API_BASE_URL}/auth/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<User>;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) {
    return false;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const tokens = (await res.json()) as AuthTokens;
    storeTokens(tokens);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

function storeTokens(tokens: AuthTokens): void {
  sessionStorage.setItem(TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

function clearTokens(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
}

export async function loginWithRedirect(
  clientId: string,
  redirectUri: string,
  scope = "openid profile email",
): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);
  sessionStorage.setItem("dopaflow_client_id", clientId);
  sessionStorage.setItem("dopaflow_redirect_uri", redirectUri);
  const baseUrl = API_BASE_URL.replace("/api/v2", "");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const authUrl = `${baseUrl}/authorize?${params}`;
  const popup = window.open(
    authUrl,
    "dopaflow-auth",
    "width=600,height=700,left=100,top=100",
  );
  if (!popup) {
    window.location.href = authUrl;
  }
}

export async function handleCallback(extraParams?: {
  code?: string;
  state?: string;
}): Promise<boolean> {
  const code =
    extraParams?.code ??
    new URLSearchParams(window.location.search).get("code");
  const state =
    extraParams?.state ??
    new URLSearchParams(window.location.search).get("state");
  const storedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!code || !state || !verifier || state !== storedState) {
    clearTokens();
    return false;
  }
  const storedClientId = sessionStorage.getItem("dopaflow_client_id");
  const storedRedirectUri = sessionStorage.getItem("dopaflow_redirect_uri");
  if (!storedClientId || !storedRedirectUri) {
    clearTokens();
    return false;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: storedRedirectUri,
        client_id: storedClientId,
        code_verifier: verifier,
      }),
    });
    clearTokens();
    if (!res.ok) {
      return false;
    }
    const tokens = (await res.json()) as AuthTokens;
    storeTokens(tokens);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export function handleDeepLinkUrl(rawUrl: string): void {
  try {
    const parsed = new URL(rawUrl);
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    if (code || state) {
      const params: { code?: string; state?: string } = {};
      if (code) {
        params.code = code;
      }
      if (state) {
        params.state = state;
      }
      void handleCallback(params);
    }
  } catch {
    // ignore malformed URL
  }
}

export async function logout(): Promise<void> {
  const accessToken = await getAccessToken();
  if (accessToken) {
    fetch(`${API_BASE_URL}/auth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: accessToken, token_hint: "access_token" }),
    }).catch(() => {});
  }
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (refreshToken) {
    fetch(`${API_BASE_URL}/auth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: refreshToken,
        token_hint: "refresh_token",
      }),
    }).catch(() => {});
  }
  clearTokens();
}

export function isAuthenticated(): boolean {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    return false;
  }
  try {
    const parsed = parseJwt(token);
    if (!parsed) {
      return false;
    }
    const exp = (parsed.exp as number) * 1000;
    return Date.now() < exp;
  } catch {
    return false;
  }
}

export const authService = {
  loginWithRedirect,
  handleCallback,
  getAccessToken,
  getUser,
  logout,
  isAuthenticated,
  parseJwt,
};
