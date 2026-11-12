import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImpactAnalysis from "@/components/ImpactAnalysis";
import { rememberShownHouseholdRequest } from "@/hooks/useHouseholdImpact";
import { HouseholdCalculationError } from "@/lib/api";
import type { HouseholdImpactResponse, HouseholdRequest } from "@/lib/types";

// Server rendering runs no effects, and this repository has no DOM test
// environment. So the components' effects are kept as they are rendered,
// and `renderImpactAnalysis` runs them after the render, as React does on
// the client; what they return to clean up runs when a test unmounts the
// results area.
const { pendingEffects, effectCleanups } = vi.hoisted(() => ({
  pendingEffects: [] as Array<() => void | (() => void)>,
  effectCleanups: [] as Array<() => void>,
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    // Every effect runs after every render, whatever its dependencies:
    // running these effects again with the same values changes nothing.
    useEffect: (effect: () => void | (() => void)) => {
      pendingEffects.push(effect);
    },
  };
});

// Recharts draws nothing without a measured container, so each chart part
// becomes an element that prints the props this test reads.
vi.mock("recharts", () => {
  const container =
    (tagName: string) =>
    ({ children }: { children?: ReactNode }) =>
      createElement(tagName, null, children);
  const printProps =
    (tagName: string, propNames: string[]) =>
    (props: Record<string, unknown>) =>
      createElement(
        tagName,
        Object.fromEntries(
          propNames.map((propName) => [
            `data-${propName.toLowerCase()}`,
            JSON.stringify(props[propName] ?? null),
          ]),
        ),
      );
  return {
    ResponsiveContainer: container("chart-container"),
    LineChart: (props: { data: unknown; children?: ReactNode }) =>
      createElement(
        "line-chart",
        { "data-data": JSON.stringify(props.data) },
        props.children,
      ),
    Line: printProps("chart-line", []),
    XAxis: printProps("x-axis", ["domain"]),
    YAxis: printProps("y-axis", []),
    CartesianGrid: printProps("cartesian-grid", []),
    Tooltip: printProps("chart-tooltip", []),
    Legend: printProps("chart-legend", []),
    ReferenceLine: printProps("reference-line", ["x", "y"]),
    ReferenceDot: printProps("reference-dot", ["x", "y"]),
  };
});

// The household whose answer is on screen: an income of $300,000 on a
// chart up to $500,000.
const shownRequest: HouseholdRequest = {
  age_head: 35,
  age_spouse: null,
  dependent_ages: [5],
  income: 300000,
  year: 2026,
  max_earnings: 500000,
  state_code: "CA",
  reform_params: { surtax_enabled: true },
};

const shownAnswer: HouseholdImpactResponse = {
  income_range: [0, 100000, 300000, 500000],
  net_income_change: [0, 100, 400, 0],
  benefit_at_income: { baseline: 250000, reform: 250400, difference: 400 },
  x_axis_max: 500000,
};

// Another household, with an income of $100,000.
const otherRequest: HouseholdRequest = { ...shownRequest, income: 100000 };

const otherAnswer: HouseholdImpactResponse = {
  ...shownAnswer,
  benefit_at_income: { baseline: 90000, reform: 90100, difference: 100 },
};

// A household the firewall refuses.
const refusedRequest: HouseholdRequest = { ...shownRequest, income: 200000 };

const REFUSAL_MESSAGE =
  "Everyone on your network, such as a workshop or an office, shares a " +
  "limit on calculations a minute, and it has been reached.";

const queryClient = new QueryClient();

afterEach(() => {
  queryClient.clear();
  rememberShownHouseholdRequest(queryClient, null);
  pendingEffects.length = 0;
  effectCleanups.length = 0;
});

/** Stores `failure` as `request`'s calculation. */
async function fail(request: HouseholdRequest, failure: Error): Promise<void> {
  await queryClient
    .fetchQuery({
      queryKey: ["householdImpact", request],
      queryFn: () => Promise.reject(failure),
      retry: false,
    })
    .catch(() => undefined);
}

/** Stores a refusal for the firewall's limit as `request`'s calculation. */
async function refuse(request: HouseholdRequest): Promise<void> {
  await fail(
    request,
    new HouseholdCalculationError(REFUSAL_MESSAGE, 429, false, true),
  );
}

/** Stores `answer` as `request`'s calculation. */
function answer(request: HouseholdRequest, impact: HouseholdImpactResponse): void {
  queryClient.setQueryData(["householdImpact", request], impact);
}

/** Renders the results area for `request`, then runs its effects. */
function renderImpactAnalysis(
  request: HouseholdRequest | null,
  props: {
    triggered?: boolean;
    maxEarnings?: number;
    onShownRequestChange?: (request: HouseholdRequest | null) => void;
  } = {},
): string {
  const markup = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ImpactAnalysis, {
        request,
        triggered: props.triggered ?? true,
        maxEarnings: props.maxEarnings ?? request?.max_earnings,
        onShownRequestChange: props.onShownRequestChange,
      }),
    ),
  );
  for (const effect of pendingEffects.splice(0)) {
    const cleanup = effect();
    if (typeof cleanup === "function") {
      effectCleanups.push(cleanup);
    }
  }
  return markup;
}

/** Removes the results area from the page, as leaving its tab does. */
function unmountImpactAnalysis(): void {
  for (const cleanup of effectCleanups.splice(0)) {
    cleanup();
  }
}

describe("ImpactAnalysis after a refusal", () => {
  it("draws the shown answer on its own range, with its income marker", async () => {
    answer(shownRequest, shownAnswer);
    rememberShownHouseholdRequest(queryClient, shownRequest);
    // The reader chose the $200k range, and the firewall refused it.
    const refusedRangeRequest = { ...shownRequest, max_earnings: 200000 };
    await refuse(refusedRangeRequest);

    const markup = renderImpactAnalysis(refusedRangeRequest, {
      maxEarnings: 200000,
    });

    expect(markup).toContain('role="status"');
    expect(markup).toContain('data-domain="[0,500000]"');
    expect(markup).toContain(
      `data-data="${JSON.stringify([
        { income: 0, benefit: 0 },
        { income: 100000, benefit: 100 },
        { income: 300000, benefit: 400 },
        { income: 500000, benefit: 0 },
      ]).replaceAll('"', "&quot;")}"`,
    );
    // The marker at the shown household's income.
    expect(markup).toContain('<reference-dot data-x="300000" data-y="400">');
  });

  it("says the results are for the household shown before", async () => {
    answer(shownRequest, shownAnswer);
    rememberShownHouseholdRequest(queryClient, shownRequest);
    await refuse(refusedRequest);

    const markup = renderImpactAnalysis(refusedRequest);

    expect(markup).toContain(REFUSAL_MESSAGE);
    expect(markup).toContain(
      "The results below are for the household shown before.",
    );
  });

  it("shows the household it drew last, after a refusal", async () => {
    // The reader calculated one household, then another, then went back
    // to the first, which the page showed from the cache.
    answer(shownRequest, shownAnswer);
    answer(otherRequest, otherAnswer);
    renderImpactAnalysis(shownRequest);
    renderImpactAnalysis(otherRequest);
    renderImpactAnalysis({ ...shownRequest });
    await refuse(refusedRequest);

    const markup = renderImpactAnalysis(refusedRequest);

    expect(markup).toContain(REFUSAL_MESSAGE);
    expect(markup).toContain("<strong>$300,000</strong>");
    expect(markup).toContain('<reference-dot data-x="300000" data-y="400">');
  });

  it("tells the page which household's answer it draws after a refusal", async () => {
    // The page highlights the chart range of the household this reports.
    answer(shownRequest, shownAnswer);
    renderImpactAnalysis(shownRequest);
    const refusedRangeRequest = { ...shownRequest, max_earnings: 200000 };
    await refuse(refusedRangeRequest);
    const onShownRequestChange = vi.fn();

    renderImpactAnalysis(refusedRangeRequest, {
      maxEarnings: 200000,
      onShownRequestChange,
    });

    expect(onShownRequestChange).toHaveBeenLastCalledWith(shownRequest);
  });

  it("shows a refusal itself after an error panel", async () => {
    // The error panel replaced the earlier answer, so a later refusal must
    // not bring that answer back.
    answer(shownRequest, shownAnswer);
    renderImpactAnalysis(shownRequest);
    await fail(
      otherRequest,
      new HouseholdCalculationError("HTTP 500", 500, false, false),
    );
    renderImpactAnalysis(otherRequest);
    await refuse(refusedRequest);

    const markup = renderImpactAnalysis(refusedRequest);

    expect(markup).toContain("Error Calculating Impact");
    expect(markup).toContain(REFUSAL_MESSAGE);
    expect(markup).not.toContain("<strong>$300,000</strong>");
  });

  it("shows a refusal itself after the results area is opened again", async () => {
    // Leaving the household tab and coming back empties the results area,
    // so a later refusal must not bring the earlier answer back.
    answer(shownRequest, shownAnswer);
    renderImpactAnalysis(shownRequest);
    unmountImpactAnalysis();
    renderImpactAnalysis(null, { triggered: false });
    await refuse(refusedRequest);

    const markup = renderImpactAnalysis(refusedRequest);

    expect(markup).toContain("Error Calculating Impact");
    expect(markup).toContain(REFUSAL_MESSAGE);
    expect(markup).not.toContain("<strong>$300,000</strong>");
  });
});
