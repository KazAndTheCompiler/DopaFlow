const defaultApiBaseUrl =
  typeof window !== "undefined" && /^https?:\/\//.test(window.location.origin)
    ? `${window.location.origin}/api/v2`
    : "http://127.0.0.1:8000/api/v2";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? defaultApiBaseUrl;

function fireToast(message: string, type: "error" | "warn"): void {
  window.dispatchEvent(new CustomEvent("dopaflow:toast", { detail: { id: Date.now(), message, type } }));
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return undefined as T;
  }

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  if (contentType.startsWith("text/") || contentType.includes("xml") || contentType.includes("javascript")) {
    return (await response.text()) as T;
  }

  const body = await response.blob();
  if (body.size === 0) {
    return undefined as T;
  }
  return body as T;
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: isFormData
        ? { ...(init?.headers ?? {}) }
        : {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
      ...init,
    });
  } catch (error) {
    fireToast("Network error — the local release backend is unreachable.", "error");
    throw new Error(
      error instanceof Error ? `network_error:${error.message}` : "network_error:unknown",
    );
  }

  if (response.status === 429) {
    fireToast("Too many requests — slow down a moment.", "warn");
    throw new Error("rate_limited");
  }

  if (response.status >= 500) {
    fireToast("Server error — check the backend is running.", "error");
    throw new Error(`server_error:${response.status}`);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const parsed = await parseApiResponse<unknown>(response);
      if (typeof parsed === "string" && parsed.trim()) {
        detail = parsed.trim();
      } else if (
        parsed &&
        typeof parsed === "object" &&
        "detail" in parsed &&
        typeof (parsed as { detail?: unknown }).detail === "string"
      ) {
        detail = (parsed as { detail: string }).detail;
      }
    } catch {
      // Ignore parse failures and preserve the HTTP status detail.
    }
    throw new Error(`API request failed: ${response.status} ${detail}`);
  }

  return parseApiResponse<T>(response);
}
