import { apiClient } from "./client";

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  date: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

export function search(
  query: string,
  options?: {
    types?: string[];
    from?: string;
    to?: string;
  }
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (options?.types?.length) {
    params.set("types", options.types.join(","));
  }
  if (options?.from) {
    params.set("from", options.from);
  }
  if (options?.to) {
    params.set("to", options.to);
  }
  return apiClient<SearchResponse>(`/search?${params.toString()}`);
}
