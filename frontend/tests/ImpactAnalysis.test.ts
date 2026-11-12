import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImpactAnalysis from "@/components/ImpactAnalysis";
import { rememberShownHouseholdRequest } from "@/hooks/useHouseholdImpact";
import { HouseholdCalculationError } from "@/lib/api";
import type { HouseholdImpactResponse, HouseholdRequest } from "@/lib/types";

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

const queryClient = new QueryClient();

afterEach(() => {
  queryClient.clear();
  rememberShownHouseholdRequest(queryClient, null);
});

/** Stores a refusal for the firewall's limit as `request`'s calculation. */
async function refuse(request: HouseholdRequest): Promise<void> {
  await queryClient
    .fetchQuery({
      queryKey: ["householdImpact", request],
      queryFn: () =>
        Promise.reject(
          new HouseholdCalculationError(
            "Everyone on your network, such as a workshop or an office, " +
              "shares a limit on calculations a minute, and it has been reached.",
            429,
            false,
            true,
          ),
        ),
      retry: false,
    })
    .catch(() => undefined);
}

function renderImpactAnalysis(
  request: HouseholdRequest,
  maxEarnings: number,
): string {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ImpactAnalysis, { request, triggered: true, maxEarnings }),
    ),
  );
}

describe("ImpactAnalysis after a refusal", () => {
  it("draws the shown answer on its own range, with its income marker", async () => {
    queryClient.setQueryData(["householdImpact", shownRequest], shownAnswer);
    rememberShownHouseholdRequest(queryClient, shownRequest);
    // The reader chose the $200k range, and the firewall refused it.
    const refusedRequest = { ...shownRequest, max_earnings: 200000 };
    await refuse(refusedRequest);

    const markup = renderImpactAnalysis(refusedRequest, 200000);

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
});
