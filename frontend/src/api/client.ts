export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v2";

function fireToast(message: string, type: "error" | "warn"): void {
  window.dispatchEvent(new CustomEvent("dopaflow:toast", { detail: { id: Date.now(), message, type } }));
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: isFormData
      ? { ...(init?.headers ?? {}) }
      : {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
    ...init,
  });

  if (response.status === 429) {
    fireToast("Too many requests — slow down a moment.", "warn");
    throw new Error("rate_limited");
  }

  if (response.status >= 500) {
    fireToast("Server error — check the backend is running.", "error");
    throw new Error(`server_error:${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
