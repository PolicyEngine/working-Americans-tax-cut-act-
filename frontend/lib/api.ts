import {
  HouseholdRequest,
  HouseholdImpactResponse,
} from "./types";
import { buildHouseholdSituation } from "./household";

const PE_API_URL = "https://api.policyengine.org";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function peCalculate(body: Record<string, any>): Promise<any> {
  const response = await fetchWithTimeout(
    `${PE_API_URL}/us/calculate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(
      `PE API error: ${response.status}`,
      response.status,
      errorBody
    );
  }
  return response.json();
}

function buildReform(surtaxEnabled: boolean): Record<string, Record<string, boolean>> {
  return {
    "gov.contrib.congress.watca.in_effect": { "2020-01-01.2100-12-31": true },
    "gov.contrib.congress.watca.surtax.in_effect": { "2020-01-01.2100-12-31": surtaxEnabled },
  };
}

function interpolate(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}

export const api = {
  async calculateHouseholdImpact(
    request: HouseholdRequest
  ): Promise<HouseholdImpactResponse> {
    const household = buildHouseholdSituation(request);
    const policy = buildReform(request.reform_params.surtax_enabled);
    const yearStr = String(request.year);

    // Run baseline and reform in parallel
    // PE API v1 uses "policy" (not "reform") for parameter overrides
    const [baselineResult, reformResult] = await Promise.all([
      peCalculate({ household }),
      peCalculate({ household, policy }),
    ]);

    // Extract net income arrays (PE API wraps response in "result")
    const baselineNetIncome: number[] =
      baselineResult.result.households["your household"]["household_net_income"][yearStr];
    const reformNetIncome: number[] =
      reformResult.result.households["your household"]["household_net_income"][yearStr];

    // Extract AGI x-axis values
    const incomeRange: number[] =
      baselineResult.result.tax_units["your tax unit"]["adjusted_gross_income"][yearStr];

    // Compute element-wise net income change
    const netIncomeChange = reformNetIncome.map(
      (val: number, i: number) => val - baselineNetIncome[i]
    );

    // Interpolate point estimate at user's income
    const baselineAtIncome = interpolate(incomeRange, baselineNetIncome, request.income);
    const reformAtIncome = interpolate(incomeRange, reformNetIncome, request.income);

    return {
      income_range: incomeRange,
      net_income_change: netIncomeChange,
      benefit_at_income: {
        baseline: baselineAtIncome,
        reform: reformAtIncome,
        difference: reformAtIncome - baselineAtIncome,
      },
      x_axis_max: request.max_earnings,
    };
  },
};
