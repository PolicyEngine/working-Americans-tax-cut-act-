/**
 * Household impact via www.policyengine.org's dashboard API.
 *
 * The page never calls the PolicyEngine Public API itself: the dashboard
 * API's server adds PolicyEngine's credential and forwards each household
 * to the Public API's /us/calculate.
 */

import {
  createPolicyEngineApiClient,
  DEFAULT_BASE_URL,
  PolicyEngineApiError,
  RATE_LIMIT_WAIT_MILLISECONDS,
} from "@policyengine/api-client";

import {
  HouseholdRequest,
  HouseholdImpactResponse,
} from "./types";
import { buildHouseholdSituation } from "./household";

const policyengine = createPolicyEngineApiClient();

/** How long a calculation may take before the page gives up on it. */
const CALCULATION_TIMEOUT_MILLISECONDS = 120_000;

/** Brief gateway failures, which are worth retrying. */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/**
 * What the page says about the firewall's limit, which everyone behind one
 * address shares.
 */
export const SHARED_LIMIT_EXPLANATION =
  "Everyone on your network, such as a workshop or an office, shares a " +
  "limit on calculations a minute";

const RATE_LIMIT_REFUSAL_MESSAGE = `${SHARED_LIMIT_EXPLANATION}, and it has been reached.`;

/**
 * When the page may send household calculations again after a refusal for
 * the firewall's limit, in `Date.now()` milliseconds. Every household
 * calculation checks it when it is sent.
 */
let householdCalculationsPausedUntil = 0;
const pauseListeners = new Set<() => void>();

/**
 * Stops the page from sending household calculations for `milliseconds`
 * (the firewall's minute unless given); 0 ends a pause.
 */
export function pauseHouseholdCalculations(
  milliseconds: number = RATE_LIMIT_WAIT_MILLISECONDS,
): void {
  householdCalculationsPausedUntil = Date.now() + milliseconds;
  pauseListeners.forEach((listener) => listener());
}

/** Milliseconds until the page may send household calculations again; 0 when it may now. */
export function householdCalculationPauseRemaining(): number {
  return Math.max(0, householdCalculationsPausedUntil - Date.now());
}

/** Calls `listener` whenever a pause starts or is ended early; returns the unsubscribe. */
export function onHouseholdCalculationPause(listener: () => void): () => void {
  pauseListeners.add(listener);
  return () => {
    pauseListeners.delete(listener);
  };
}

/**
 * Whether the page is served from the dashboard API's own origin
 * (www.policyengine.org, through the website's rewrites), where the
 * firewall's 429 is readable.
 */
function pageSharesDashboardApiOrigin(): boolean {
  return globalThis.location?.origin === new URL(DEFAULT_BASE_URL).origin;
}

/** A household calculation failed; `message` is written for the user. */
export class HouseholdCalculationError extends Error {
  override name = "HouseholdCalculationError";

  constructor(
    message: string,
    /** The dashboard API's HTTP status, or null when no answer was read. */
    readonly status: number | null,
    /** Whether trying again at once could succeed. */
    readonly retryable: boolean,
    /**
     * Whether the firewall's limit may have refused it: a 429, no readable
     * answer on another origin (which is how such a page sees a 429), or a
     * calculation held back during the pause after a refusal.
     */
    readonly rateLimited: boolean = false,
  ) {
    super(message);
  }
}

/**
 * Whether React Query should retry a failed household calculation: once,
 * and only after a brief gateway failure. Each attempt sends two
 * calculations, and the firewall allows 30 a minute.
 */
export function shouldRetryHouseholdCalculation(
  failureCount: number,
  error: unknown,
): boolean {
  return (
    failureCount < 1 &&
    error instanceof HouseholdCalculationError &&
    error.retryable
  );
}

function dashboardApiMessage(body: unknown): string | null {
  if (typeof body === "object" && body !== null) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return null;
}

/** Turns a failure of the dashboard API client into a message for the user. */
function calculationError(error: PolicyEngineApiError): HouseholdCalculationError {
  if (error.status === null) {
    if (pageSharesDashboardApiOrigin()) {
      // The firewall's 429 would be readable here, so this is a network
      // failure.
      return new HouseholdCalculationError(
        "PolicyEngine's calculation service could not be reached. Check " +
          "your connection and try again.",
        null,
        false,
      );
    }
    // On another origin, such as the dashboard's own host, the firewall's
    // 429 has no CORS headers, so the browser reports a network failure.
    // So does the dashboard API's 403 for an origin it does not allow.
    return new HouseholdCalculationError(
      "PolicyEngine's calculation service could not be reached. " +
        `${SHARED_LIMIT_EXPLANATION}, which may have been reached.`,
      null,
      false,
      true,
    );
  }
  if (error.status === 429) {
    return new HouseholdCalculationError(
      RATE_LIMIT_REFUSAL_MESSAGE,
      429,
      false,
      true,
    );
  }
  const detail =
    dashboardApiMessage(error.body) ?? "Try again in a few minutes.";
  return new HouseholdCalculationError(
    `PolicyEngine could not calculate this household (HTTP ${error.status}): ${detail}`,
    error.status,
    RETRYABLE_STATUSES.has(error.status),
  );
}

/** Values over the income axis, keyed by year. */
type ValuesByYear = Record<string, number[]>;

/** The parts of a calculated household this page reads. */
interface CalculatedHousehold {
  tax_units: Record<string, Record<string, ValuesByYear>>;
  households: Record<string, Record<string, ValuesByYear>>;
}

async function calculateHousehold(
  household: Record<string, unknown>,
  policy?: Record<string, unknown>
): Promise<CalculatedHousehold> {
  if (householdCalculationPauseRemaining() > 0) {
    // Held back during the pause after a refusal, so never sent. The pause
    // may have started from a request with no answer, which only may have
    // met the limit.
    throw new HouseholdCalculationError(
      `${SHARED_LIMIT_EXPLANATION}, which may have been reached.`,
      null,
      false,
      true,
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    CALCULATION_TIMEOUT_MILLISECONDS
  );
  try {
    return await policyengine.calculateHousehold<CalculatedHousehold>(
      { country: "us", household, policy },
      { signal: controller.signal }
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new HouseholdCalculationError(
        "The calculation took longer than two minutes. Try again.",
        null,
        false,
      );
    }
    if (error instanceof PolicyEngineApiError) {
      const failure = calculationError(error);
      if (failure.rateLimited) {
        // Pause at once, even if the household's other calculation has
        // already failed and the caller never sees this refusal.
        pauseHouseholdCalculations();
      }
      throw failure;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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

    // Run baseline and reform in parallel. Each resolves with the
    // calculated household (the Public API's `result`); "policy" holds the
    // reform's parameter changes.
    const [baselineResult, reformResult] = await Promise.all([
      calculateHousehold(household),
      calculateHousehold(household, policy),
    ]);

    // Extract net income arrays
    const baselineNetIncome: number[] =
      baselineResult.households["your household"]["household_net_income"][yearStr];
    const reformNetIncome: number[] =
      reformResult.households["your household"]["household_net_income"][yearStr];

    // Extract AGI x-axis values
    const incomeRange: number[] =
      baselineResult.tax_units["your tax unit"]["adjusted_gross_income"][yearStr];

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
