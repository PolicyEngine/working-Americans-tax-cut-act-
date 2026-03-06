'use client';

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

interface Props {
  surtaxEnabled: boolean;
  triggered: boolean;
}

export default function AggregateImpact({ surtaxEnabled, triggered }: Props) {
  const { data, isLoading, error } = useAggregateImpact(surtaxEnabled, triggered);

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
    const errorDetails = (error as any)?.response?.data || (error as any)?.cause || '';

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading National Impact</h3>
        <p className="text-red-700 font-medium mb-2">{errorMessage}</p>
        {errorDetails && (
          <details className="mt-2">
            <summary className="cursor-pointer text-red-600 text-sm">Show technical details</summary>
            <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(errorDetails, null, 2)}
            </pre>
          </details>
        )}
        <p className="text-sm text-gray-600 mt-4">
          Ensure precomputed data exists. Run: <code>python scripts/precompute.py</code>
        </p>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatCurrencyWithSign = (value: number) => {
    const formatted = `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  };
  const formatBillions = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return formatCurrency(value);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-primary">National Impact Analysis</h2>

      <p className="text-gray-700">
        This analysis uses the Enhanced CPS microsimulation dataset to estimate the aggregate
        impact of the Working Americans&apos; Tax Cut Act across all US households.
      </p>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-primary-50 rounded-lg p-6 border border-primary-500">
          <p className="text-sm text-gray-700 mb-2">Total Cost / Revenue</p>
          <p className="text-3xl font-bold text-primary-600">
            {data.total_cost >= 0 ? '+' : '-'}{formatBillions(Math.abs(data.total_cost))}
          </p>
          <p className="text-xs text-gray-600 mt-1">Net annual fiscal impact</p>
        </div>

        <div className="bg-green-50 rounded-lg p-6 border border-success">
          <p className="text-sm text-gray-700 mb-2">Households Benefiting</p>
          <p className="text-3xl font-bold text-green-600">
            {(data.beneficiaries / 1e6).toFixed(1)}M
          </p>
          <p className="text-xs text-gray-600 mt-1">Number of US households that benefit</p>
        </div>

        <div className={`rounded-lg p-6 border ${data.avg_benefit >= 0 ? 'bg-blue-50 border-blue-500' : 'bg-gray-100 border-gray-400'}`}>
          <p className="text-sm text-gray-700 mb-2">Average Impact</p>
          <p className={`text-3xl font-bold ${data.avg_benefit >= 0 ? 'text-blue-600' : 'text-gray-600'}`} style={data.avg_benefit < 0 ? { color: '#64748B' } : {}}>
            {formatCurrencyWithSign(data.avg_benefit)}
          </p>
          <p className="text-xs text-gray-600 mt-1">Average annual impact per benefiting household</p>
        </div>
      </div>

      {/* Poverty Impact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-300">
          <p className="text-sm text-gray-600 mb-2">Poverty Rate Change</p>
          <p className={`text-3xl font-bold ${data.poverty_percent_change <= 0 ? 'text-green-700' : 'text-gray-600'}`} style={data.poverty_percent_change > 0 ? { color: '#64748B' } : {}}>
            {data.poverty_percent_change >= 0 ? '+' : ''}{data.poverty_percent_change.toFixed(2)}%
          </p>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Deep Poverty</p>
            <p className={`text-lg font-semibold ${data.deep_poverty_percent_change <= 0 ? 'text-green-600' : 'text-gray-500'}`} style={data.deep_poverty_percent_change > 0 ? { color: '#64748B' } : {}}>
              {data.deep_poverty_percent_change >= 0 ? '+' : ''}{data.deep_poverty_percent_change.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-500">
          <p className="text-sm text-gray-600 mb-2">Child Poverty Rate Change</p>
          <p className={`text-3xl font-bold ${data.child_poverty_percent_change <= 0 ? 'text-green-700' : 'text-gray-600'}`} style={data.child_poverty_percent_change > 0 ? { color: '#64748B' } : {}}>
            {data.child_poverty_percent_change >= 0 ? '+' : ''}{data.child_poverty_percent_change.toFixed(2)}%
          </p>
          <div className="mt-3 pt-3 border-t border-yellow-200">
            <p className="text-xs text-gray-500 mb-1">Deep Child Poverty</p>
            <p className={`text-lg font-semibold ${data.deep_child_poverty_percent_change <= 0 ? 'text-green-600' : 'text-gray-500'}`} style={data.deep_child_poverty_percent_change > 0 ? { color: '#64748B' } : {}}>
              {data.deep_child_poverty_percent_change >= 0 ? '+' : ''}{data.deep_child_poverty_percent_change.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-500">
          <p className="text-sm text-gray-600 mb-2">Winners / Losers</p>
          <p className="text-3xl font-bold text-indigo-700">
            {data.winners_rate.toFixed(1)}% / {data.losers_rate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Percentage of households that gain vs. lose</p>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Impact by Income Bracket */}
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

        {/* Detailed Table */}
        <div className="mt-6">
          <details className="bg-gray-50 rounded-lg p-4">
            <summary className="cursor-pointer font-semibold text-gray-700 hover:text-primary">
              View detailed breakdown
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Income Bracket
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Affected Households
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Total Benefit/Loss
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Average Impact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.by_income_bracket.map((bracket, index) => (
                    <tr key={index} className="hover:bg-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-900">{bracket.bracket}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {Math.round(bracket.beneficiaries).toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold ${bracket.total_cost >= 0 ? 'text-green-600' : ''}`}
                        style={bracket.total_cost < 0 ? { color: '#64748B' } : {}}
                      >
                        {formatCurrencyWithSign(bracket.total_cost)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold ${bracket.avg_benefit >= 0 ? 'text-green-600' : ''}`}
                        style={bracket.avg_benefit < 0 ? { color: '#64748B' } : {}}
                      >
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
    </div>
  );
}
