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
  Legend,
} from 'recharts';

interface Props {
  surtaxEnabled: boolean;
  triggered: boolean;
}

export default function AggregateImpact({ surtaxEnabled, triggered }: Props) {
  const { data, isLoading, error } = useAggregateImpact(surtaxEnabled, triggered);
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
        <h3 className="text-red-800 font-semibold mb-2">Error Loading National Impact</h3>
        <p className="text-red-700 font-medium mb-2">{errorMessage}</p>
        <p className="text-sm text-gray-600 mt-4">
          Ensure precomputed data exists. Run: <code>python scripts/precompute.py</code>
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
    { key: 'fiscal' as const, label: 'Budgetary Impact' },
    { key: 'distributional' as const, label: 'Distributional Impact' },
    { key: 'winners' as const, label: 'Winners & Losers' },
    { key: 'poverty' as const, label: 'Poverty Impact' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-primary">National Impact Analysis</h2>

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
            <p className="text-sm text-gray-700 mb-2">Net Budgetary Impact</p>
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

          {/* Breakdown cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Tax Revenue Impact</p>
              <p className={`text-2xl font-bold ${data.budget.tax_revenue_impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatBillions(data.budget.tax_revenue_impact)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Change in federal tax revenue</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Benefit Spending Impact</p>
              <p className={`text-2xl font-bold ${data.budget.benefit_spending_impact <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatBillions(data.budget.benefit_spending_impact)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Change in benefit spending</p>
            </div>
          </div>

          {/* Income bracket chart */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Impact by Income Bracket</h3>
            <div className="bg-white border rounded-lg p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.by_income_bracket}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="bracket" stroke="#666" />
                  <YAxis tickFormatter={formatCurrencyWithSign} stroke="#666" width={80} />
                  <Tooltip formatter={(value: number) => formatCurrencyWithSign(value)} />
                  <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
                  <Bar dataKey="avg_benefit" name="Average Impact">
                    {data.by_income_bracket.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.avg_benefit >= 0 ? '#319795' : '#64748B'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed table */}
            <details className="mt-4 bg-gray-50 rounded-lg p-4">
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-primary">
                View detailed breakdown
              </summary>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Income Bracket</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Affected Households</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Total Impact</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Average Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.by_income_bracket.map((bracket, index) => (
                      <tr key={index} className="hover:bg-gray-100">
                        <td className="px-4 py-3 text-sm text-gray-900">{bracket.bracket}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{Math.round(bracket.beneficiaries).toLocaleString()}</td>
                        <td className={`px-4 py-3 text-sm font-semibold ${bracket.total_cost >= 0 ? 'text-green-600' : ''}`}
                          style={bracket.total_cost < 0 ? { color: '#64748B' } : {}}>
                          {formatBillions(bracket.total_cost)}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${bracket.avg_benefit >= 0 ? 'text-green-600' : ''}`}
                          style={bracket.avg_benefit < 0 ? { color: '#64748B' } : {}}>
                          {formatCurrencyWithSign(bracket.avg_benefit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* ===== DISTRIBUTIONAL IMPACT ===== */}
      {activeSection === 'distributional' && (
        <div className="space-y-6">
          <p className="text-gray-700">
            Average impact on household net income by income decile. Decile 1 is the lowest income, decile 10 is the highest.
          </p>

          {/* Average absolute impact by decile */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Average Impact by Income Decile</h3>
            <div className="bg-white border rounded-lg p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(data.decile.average).map(([k, v]) => ({ decile: k, value: v }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="decile" stroke="#666" label={{ value: 'Income Decile', position: 'insideBottom', offset: -5 }} />
                  <YAxis tickFormatter={formatCurrencyWithSign} stroke="#666" width={80} />
                  <Tooltip formatter={(value: number) => [formatCurrencyWithSign(value), 'Average Impact']} />
                  <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
                  <Bar dataKey="value" name="Average Impact">
                    {Object.values(data.decile.average).map((v, i) => (
                      <Cell key={i} fill={v >= 0 ? '#319795' : '#64748B'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Relative impact by decile */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Relative Impact by Income Decile</h3>
            <div className="bg-white border rounded-lg p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(data.decile.relative).map(([k, v]) => ({ decile: k, value: v * 100 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="decile" stroke="#666" label={{ value: 'Income Decile', position: 'insideBottom', offset: -5 }} />
                  <YAxis tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} stroke="#666" width={60} />
                  <Tooltip formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`, 'Relative Impact']} />
                  <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
                  <Bar dataKey="value" name="Relative Impact (% of income)">
                    {Object.values(data.decile.relative).map((v, i) => (
                      <Cell key={i} fill={v >= 0 ? '#319795' : '#64748B'} />
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
          { key: 'gain_more_than_5pct', label: 'Gain more than 5%', color: '#15803d' },
          { key: 'gain_less_than_5pct', label: 'Gain less than 5%', color: '#86efac' },
          { key: 'no_change', label: 'No change', color: '#e5e7eb' },
          { key: 'lose_less_than_5pct', label: 'Lose less than 5%', color: '#fca5a5' },
          { key: 'lose_more_than_5pct', label: 'Lose more than 5%', color: '#b91c1c' },
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
              <div className="bg-green-50 rounded-lg p-6 border border-success">
                <p className="text-sm text-gray-700 mb-2">Winners</p>
                <p className="text-3xl font-bold text-green-600">{data.winners_rate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-1">{Math.round(data.winners).toLocaleString()} households gain</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-300">
                <p className="text-sm text-gray-700 mb-2">No Change</p>
                <p className="text-3xl font-bold text-gray-600">
                  {(100 - data.winners_rate - data.losers_rate).toFixed(1)}%
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-6 border border-red-300">
                <p className="text-sm text-gray-700 mb-2">Losers</p>
                <p className="text-3xl font-bold text-red-600">{data.losers_rate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-1">{Math.round(data.losers).toLocaleString()} households lose</p>
              </div>
            </div>

            {/* Stacked bar chart by decile */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Winners & Losers by Income Decile</h3>
              <div className="bg-white border rounded-lg p-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stackedData} layout="vertical" stackOffset="expand" barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} stroke="#666" />
                    <YAxis type="category" dataKey="label" stroke="#666" width={40} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                    {categories.map((c) => (
                      <Bar key={c.key} dataKey={c.key} stackId="a" fill={c.color} name={c.label} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
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
          const change = m.reform - m.baseline;
          const pctChange = m.baseline !== 0 ? (change / m.baseline) * 100 : 0;
          return { ...m, change, pctChange };
        });

        return (
          <div className="space-y-6">
            <p className="text-gray-700">
              Impact on poverty rates, measured as the share of people below the poverty line.
            </p>

            {/* Metric cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chartData.map((m, i) => {
                const improved = m.change <= 0;
                return (
                  <div key={i} className={`rounded-lg p-6 border ${
                    improved ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                  }`}>
                    <p className="text-sm text-gray-700 mb-2">{m.label}</p>
                    <p className={`text-3xl font-bold ${improved ? 'text-green-700' : 'text-red-700'}`}>
                      {formatPct(m.pctChange)}
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                      <p className="text-xs text-gray-500">
                        Baseline: {m.baseline.toFixed(2)}% → Reform: {m.reform.toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {m.change > 0 ? '+' : ''}{m.change.toFixed(2)} percentage points
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bar chart: relative change */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Relative Change in Poverty Rates</h3>
              <div className="bg-white border rounded-lg p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="label" stroke="#666" />
                    <YAxis tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} stroke="#666" width={60} />
                    <Tooltip formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`, 'Relative Change']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
                    <Bar dataKey="pctChange" name="Relative Change">
                      {chartData.map((m, i) => (
                        <Cell key={i} fill={m.pctChange <= 0 ? '#319795' : '#EF4444'} />
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
