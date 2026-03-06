'use client';

import { useState } from 'react';
import { useAggregateImpact } from '@/hooks/useAggregateImpact';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

// App-v2 color tokens
const COLORS = {
  gainMore5: '#285E61',    // primary-700
  gainLess5: '#31979599',  // primary-500 @ 60%
  noChange: '#E2E8F0',     // gray-200
  loseLess5: '#9CA3AF',    // gray-400
  loseMore5: '#4B5563',    // gray-600
  positive: '#319795',     // primary-500
  negative: '#4B5563',     // gray-600
};

const YEARS = Array.from({ length: 10 }, (_, i) => 2026 + i);

// Shared chart margins
const CHART_MARGIN = { top: 20, right: 20, bottom: 30, left: 60 };

// Shared axis tick style
const TICK_STYLE = { fontFamily: 'Inter, sans-serif', fontSize: 12 };

// Custom tooltip component
function CustomTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 4,
      padding: '8px 12px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 12,
    }}>
      {label && <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#1A202C' }}>{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: 0, color: entry.color || '#4A5568' }}>
          {entry.name}: {formatter ? formatter(entry.value, entry.name) : entry.value}
        </p>
      ))}
    </div>
  );
}

interface Props {
  surtaxEnabled: boolean;
  triggered: boolean;
}

export default function AggregateImpact({ surtaxEnabled, triggered }: Props) {
  const [selectedYear, setSelectedYear] = useState(2026);
  const { data, isLoading, error } = useAggregateImpact(surtaxEnabled, triggered, selectedYear);
  const [activeSection, setActiveSection] = useState<'fiscal' | 'distributional' | 'winners' | 'poverty'>('fiscal');

  if (!triggered) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading national impact data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error loading national impact</h3>
        <p className="text-red-700 font-medium mb-2">{errorMessage}</p>
        <p className="text-sm text-gray-600 mt-4">
          Ensure precomputed data exists. Run: <code>python scripts/pipeline.py</code>
        </p>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) =>
    `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatCurrencyWithSign = (value: number) => {
    const formatted = formatCurrency(value);
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  };
  const formatBillions = (value: number) => {
    const abs = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    return formatCurrencyWithSign(value);
  };
  const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  // Section tabs
  const sections = [
    { key: 'fiscal' as const, label: 'Budgetary impact' },
    { key: 'distributional' as const, label: 'Distributional impact' },
    { key: 'winners' as const, label: 'Winners & losers' },
    { key: 'poverty' as const, label: 'Poverty impact' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-primary">National impact analysis</h2>

      <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
        These estimates are static: they do not capture behavioral responses such as changes in labor supply, tax avoidance, or migration.
      </p>

      {/* Year selector */}
      <div>
        <p className="text-sm text-gray-500 mb-2">Select year</p>
        <div className="flex flex-wrap gap-1.5">
          {YEARS.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedYear === year
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === s.key
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ===== FISCAL IMPACT ===== */}
      {activeSection === 'fiscal' && (
        <div className="space-y-6">
          {/* Headline number */}
          <div className={`rounded-lg p-6 border ${
            data.budget.budgetary_impact >= 0
              ? 'bg-green-50 border-success'
              : 'bg-red-50 border-red-300'
          }`}>
            <p className="text-sm text-gray-700 mb-2">Net budgetary impact ({selectedYear})</p>
            <p className={`text-4xl font-bold ${
              data.budget.budgetary_impact >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatBillions(data.budget.budgetary_impact)}
            </p>
            <p className="text-xs text-gray-600 mt-2">
              {data.budget.budgetary_impact >= 0
                ? 'Net revenue gain for the federal government'
                : 'Net cost to the federal government'}
              {' '}({formatBillions(-data.budget.budgetary_impact)} change in household net income)
            </p>
          </div>

          {/* Income bracket table */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Impact by income bracket</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Income bracket</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Affected households</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total impact</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Average impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.by_income_bracket.map((bracket, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{bracket.bracket}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{Math.round(bracket.beneficiaries).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right"
                        style={{ color: bracket.total_cost >= 0 ? COLORS.positive : COLORS.negative }}>
                        {formatBillions(bracket.total_cost)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-right"
                        style={{ color: bracket.avg_benefit >= 0 ? COLORS.positive : COLORS.negative }}>
                        {formatCurrencyWithSign(bracket.avg_benefit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== DISTRIBUTIONAL IMPACT ===== */}
      {activeSection === 'distributional' && (
        <div className="space-y-6">
          <p className="text-gray-700">
            Impact on household net income by income decile. Decile 1 is the lowest income, decile 10 is the highest.
          </p>

          {/* Relative impact by decile (primary) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Relative impact by income decile</h3>
            <div className="bg-white border rounded-lg p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(data.decile.relative).map(([k, v]) => ({ decile: k, value: v * 100 }))} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="decile" tick={TICK_STYLE} stroke="#A0AEC0" label={{ value: 'Income Decile', position: 'insideBottom', offset: -15, style: { ...TICK_STYLE, fill: '#718096' } }} />
                  <YAxis tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} tick={TICK_STYLE} stroke="#A0AEC0" width={60} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`} />} />
                  <ReferenceLine y={0} stroke="#A0AEC0" strokeWidth={1} />
                  <Bar dataKey="value" name="Relative Impact (% of income)" radius={[2, 2, 0, 0]}>
                    {Object.values(data.decile.relative).map((v, i) => (
                      <Cell key={i} fill={v >= 0 ? COLORS.positive : COLORS.negative} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Average absolute impact by decile (secondary) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Average impact by income decile</h3>
            <div className="bg-white border rounded-lg p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(data.decile.average).map(([k, v]) => ({ decile: k, value: v }))} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="decile" tick={TICK_STYLE} stroke="#A0AEC0" label={{ value: 'Income Decile', position: 'insideBottom', offset: -15, style: { ...TICK_STYLE, fill: '#718096' } }} />
                  <YAxis tickFormatter={formatCurrencyWithSign} tick={TICK_STYLE} stroke="#A0AEC0" width={80} />
                  <Tooltip content={<CustomTooltip formatter={(v) => formatCurrencyWithSign(v)} />} />
                  <ReferenceLine y={0} stroke="#A0AEC0" strokeWidth={1} />
                  <Bar dataKey="value" name="Average Impact" radius={[2, 2, 0, 0]}>
                    {Object.values(data.decile.average).map((v, i) => (
                      <Cell key={i} fill={v >= 0 ? COLORS.positive : COLORS.negative} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ===== WINNERS & LOSERS ===== */}
      {activeSection === 'winners' && (() => {
        const intra = data.intra_decile;
        const categories = [
          { key: 'gain_more_than_5pct', label: 'Gain more than 5%', color: COLORS.gainMore5 },
          { key: 'gain_less_than_5pct', label: 'Gain less than 5%', color: COLORS.gainLess5 },
          { key: 'no_change', label: 'No change', color: COLORS.noChange },
          { key: 'lose_less_than_5pct', label: 'Lose less than 5%', color: COLORS.loseLess5 },
          { key: 'lose_more_than_5pct', label: 'Lose more than 5%', color: COLORS.loseMore5 },
        ] as const;

        // Build stacked data: "All" row + 10 decile rows
        const stackedData = [
          {
            label: 'All',
            ...Object.fromEntries(categories.map(c => [c.key, (intra.all[c.key] * 100)])),
          },
          ...Array.from({ length: 10 }, (_, i) => ({
            label: `${i + 1}`,
            ...Object.fromEntries(categories.map(c => [c.key, (intra.deciles[c.key][i] * 100)])),
          })),
        ];

        return (
          <div className="space-y-6">
            {/* Headline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg p-6 border" style={{ backgroundColor: '#F0FDFA', borderColor: COLORS.positive }}>
                <p className="text-sm text-gray-700 mb-2">Winners</p>
                <p className="text-3xl font-bold" style={{ color: COLORS.gainMore5 }}>{data.winners_rate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-1">{Math.round(data.winners).toLocaleString()} households gain</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-300">
                <p className="text-sm text-gray-700 mb-2">No Change</p>
                <p className="text-3xl font-bold text-gray-600">
                  {(100 - data.winners_rate - data.losers_rate).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg p-6 border" style={{ backgroundColor: '#F9FAFB', borderColor: COLORS.loseMore5 }}>
                <p className="text-sm text-gray-700 mb-2">Losers</p>
                <p className="text-3xl font-bold" style={{ color: COLORS.loseMore5 }}>{data.losers_rate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-1">{Math.round(data.losers).toLocaleString()} households lose</p>
              </div>
            </div>

            {/* Stacked bar chart by decile */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Winners & losers by income decile</h3>
              <div className="bg-white border rounded-lg p-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stackedData} layout="vertical" stackOffset="expand" barSize={24} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={TICK_STYLE} stroke="#A0AEC0" />
                    <YAxis type="category" dataKey="label" tick={TICK_STYLE} stroke="#A0AEC0" width={40} />
                    <Tooltip content={<CustomTooltip formatter={(v) => `${v.toFixed(1)}%`} />} />
                    {categories.map((c) => (
                      <Bar key={c.key} dataKey={c.key} stackId="a" fill={c.color} name={c.label} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                {/* Custom legend */}
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {categories.map((c) => (
                    <div key={c.key} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color }} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4A5568' }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== POVERTY IMPACT ===== */}
      {activeSection === 'poverty' && (() => {
        const pov = data.poverty;
        const povertyMetrics = [
          {
            label: 'Overall Poverty',
            baseline: pov.poverty.all.baseline,
            reform: pov.poverty.all.reform,
          },
          {
            label: 'Child Poverty',
            baseline: pov.poverty.child.baseline,
            reform: pov.poverty.child.reform,
          },
          {
            label: 'Deep Poverty',
            baseline: pov.deep_poverty.all.baseline,
            reform: pov.deep_poverty.all.reform,
          },
          {
            label: 'Deep Child Poverty',
            baseline: pov.deep_poverty.child.baseline,
            reform: pov.deep_poverty.child.reform,
          },
        ];

        const chartData = povertyMetrics.map((m) => {
          const ppChange = m.reform - m.baseline;
          return { ...m, ppChange };
        });

        return (
          <div className="space-y-6">
            <p className="text-gray-700">
              Impact on poverty rates, measured as the share of people below the poverty line.
            </p>

            {/* Metric cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chartData.map((m, i) => {
                const improved = m.ppChange <= 0;
                return (
                  <div key={i} className={`rounded-lg p-6 border ${
                    improved ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                  }`}>
                    <p className="text-sm text-gray-700 mb-2">{m.label}</p>
                    <p className={`text-3xl font-bold ${improved ? 'text-green-700' : 'text-red-700'}`}>
                      {m.ppChange > 0 ? '+' : ''}{m.ppChange.toFixed(2)}pp
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                      <p className="text-xs text-gray-500">
                        Baseline: {m.baseline.toFixed(2)}% → Reform: {m.reform.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bar chart: pp change */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Change in poverty rates (pp)</h3>
              <div className="bg-white border rounded-lg p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={TICK_STYLE} stroke="#A0AEC0" />
                    <YAxis tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}pp`} tick={TICK_STYLE} stroke="#A0AEC0" width={70} />
                    <Tooltip content={<CustomTooltip formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}pp`} />} />
                    <ReferenceLine y={0} stroke="#A0AEC0" strokeWidth={1} />
                    <Bar dataKey="ppChange" name="Change (pp)" radius={[2, 2, 0, 0]}>
                      {chartData.map((m, i) => (
                        <Cell key={i} fill={m.ppChange <= 0 ? COLORS.positive : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
