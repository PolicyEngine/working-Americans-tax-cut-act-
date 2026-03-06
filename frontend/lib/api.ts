import {
  HouseholdRequest,
  HouseholdImpactResponse,
  AggregateImpactResponse,
  HealthResponse,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

class ApiError extends Error {
  status: number;
  response: unknown;
  constructor(message: string, status: number, response?: unknown) {
    super(message);
    this.status = status;
    this.response = response;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = 120000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function post<T>(path: string, body: unknown, timeout?: number): Promise<T> {
  const response = await fetchWithTimeout(
    `${API_URL}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeout
  );
  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(
      `API error: ${response.status}`,
      response.status,
      errorBody
    );
  }
  return response.json();
}

export const api = {
  async calculateHouseholdImpact(
    request: HouseholdRequest
  ): Promise<HouseholdImpactResponse> {
    return post<HouseholdImpactResponse>("/household-impact", request);
  },

  async calculateAggregateImpact(
    surtaxEnabled: boolean
  ): Promise<AggregateImpactResponse> {
    return post<AggregateImpactResponse>("/aggregate-impact", {
      surtax_enabled: surtaxEnabled,
    });
  },

  async health(): Promise<HealthResponse> {
    const response = await fetchWithTimeout(
      `${API_URL}/health`,
      { method: "GET" },
      5000
    );
    return response.json();
  },
};
