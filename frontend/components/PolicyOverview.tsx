'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';

const FILING_STATUSES = [
  { key: 'single', label: 'Single', exemption: 46_000, stdDed: 16_100, color: '#319795' },
  { key: 'hoh', label: 'Head of household', exemption: 64_400, stdDed: 24_150, color: '#285E61' },
  { key: 'joint', label: 'Married filing jointly', exemption: 92_000, stdDed: 32_200, color: '#1D4044' },
];

const PHASE_OUT_MULTIPLE = 1.75;

const SURTAX_SINGLE = [
  { threshold: 0, rate: 0 },
  { threshold: 1_000_000, rate: 0.05 },
  { threshold: 2_000_000, rate: 0.10 },
  { threshold: 5_000_000, rate: 0.12 },
];

const SURTAX_JOINT = [
  { threshold: 0, rate: 0 },
  { threshold: 1_500_000, rate: 0.05 },
  { threshold: 3_000_000, rate: 0.10 },
  { threshold: 7_500_000, rate: 0.12 },
];

function calcExemption(agi: number, exemptionAmount: number): number {
  const phaseOutEnd = exemptionAmount * PHASE_OUT_MULTIPLE;
  const phaseOutRange = phaseOutEnd - exemptionAmount;
  const fraction = Math.max(0, Math.min(1, (phaseOutEnd - agi) / phaseOutRange));
  return exemptionAmount * fraction;
}

function calcTaxableIncome(agi: number, exemptionAmount: number, stdDed: number): number {
  const exemption = calcExemption(agi, exemptionAmount);
  return Math.max(0, agi - stdDed - exemption);
}

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatDollarFull(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export default function PolicyOverview() {
  const [selectedFs, setSelectedFs] = useState(0);
  const exemptionData = useMemo(() => {
    const points = [];
    for (let agi = 0; agi <= 180_000; agi += 1_000) {
      const point: Record<string, number> = { agi };
      for (const fs of FILING_STATUSES) {
        point[fs.key] = calcExemption(agi, fs.exemption);
      }
      points.push(point);
    }
    return points;
  }, []);

  const taxableIncomeData = useMemo(() => {
    const points = [];
    for (let agi = 0; agi <= 180_000; agi += 1_000) {
      const point: Record<string, number> = { agi };
      for (const fs of FILING_STATUSES) {
        point[`${fs.key}_watca`] = calcTaxableIncome(agi, fs.exemption, fs.stdDed);
        point[`${fs.key}_baseline`] = Math.max(0, agi - fs.stdDed);
      }
      points.push(point);
    }
    return points;
  }, []);

  const zeroTaxThresholds = FILING_STATUSES.map((fs) => {
    const poRate = fs.exemption / (fs.exemption * 0.75);
    const threshold = fs.exemption + fs.stdDed / (1 + poRate);
    return { ...fs, threshold: Math.round(threshold) };
  });

  return (
    <div className="space-y-10">
      {/* Summary */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Working Americans&apos; Tax Cut Act
        </h2>
        <p className="text-gray-700 mb-4">
          The Working Americans&apos; Tax Cut Act, introduced by Senator Chris Van Hollen,
          has two main provisions:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <h3 className="font-semibold text-primary-800 mb-2">Cost-of-living exemption</h3>
            <p className="text-sm text-primary-700">
              A new exemption from taxable income that phases out between the exemption
              amount and 175% of the exemption amount, varying by filing status.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Millionaire surtax</h3>
            <p className="text-sm text-gray-700">
              A marginal surtax on AGI above $1M (single) or $1.5M (joint), with
              rates of 5%, 10%, and 12% at higher thresholds.
            </p>
          </div>
        </div>
      </div>

      {/* Exemption amounts table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Exemption amounts and zero-tax thresholds
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-3 border">Filing status</th>
                <th className="text-right p-3 border">Exemption</th>
                <th className="text-right p-3 border">Phase-out ends</th>
                <th className="text-right p-3 border">Standard deduction</th>
                <th className="text-right p-3 border">Zero-tax threshold</th>
              </tr>
            </thead>
            <tbody>
              {zeroTaxThresholds.map((fs) => (
                <tr key={fs.key}>
                  <td className="p-3 border font-medium">{fs.label}</td>
                  <td className="p-3 border text-right">{formatDollarFull(fs.exemption)}</td>
                  <td className="p-3 border text-right">{formatDollarFull(Math.round(fs.exemption * PHASE_OUT_MULTIPLE))}</td>
                  <td className="p-3 border text-right">{formatDollarFull(fs.stdDed)}</td>
                  <td className="p-3 border text-right font-semibold">{formatDollarFull(fs.threshold)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-2">
            The zero-tax threshold is the AGI below which taxable income is zero under WATCA.
            The phase-out reduces the exemption by $1.33 per additional dollar of AGI,
            but each dollar of AGI also directly increases taxable income, so the combined
            effective rate is $2.33 per dollar.
          </p>
        </div>
      </div>

      {/* Exemption phase-out chart */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Exemption amount by AGI
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={exemptionData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agi" tickFormatter={formatDollar} type="number" allowDecimals={false} />
              <YAxis tickFormatter={formatDollar} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => formatDollarFull(value)}
                labelFormatter={(label: number) => `AGI: ${formatDollarFull(label)}`}
              />
              <Legend />
              {FILING_STATUSES.map((fs) => (
                <Area
                  key={fs.key}
                  type="monotone"
                  dataKey={fs.key}
                  name={fs.label}
                  stroke={fs.color}
                  fill={fs.color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Taxable income comparison — tabbed by filing status */}
      {(() => {
        const fs = FILING_STATUSES[selectedFs];
        const baselineZero = fs.stdDed;
        const watcaZero = zeroTaxThresholds[selectedFs].threshold;
        return (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Taxable income: baseline vs. WATCA
            </h3>
            <div className="flex gap-1 mb-3">
              {FILING_STATUSES.map((f, i) => (
                <button
                  key={f.key}
                  onClick={() => setSelectedFs(i)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedFs === i
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={selectedFs === i ? { backgroundColor: f.color } : undefined}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={taxableIncomeData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agi" tickFormatter={formatDollar} type="number" allowDecimals={false} />
                  <YAxis tickFormatter={formatDollar} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => formatDollarFull(value)}
                    labelFormatter={(label: number) => `AGI: ${formatDollarFull(label)}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey={`${fs.key}_baseline`}
                    name="Baseline"
                    stroke="#9ca3af"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={`${fs.key}_watca`}
                    name="Under WATCA"
                    stroke={fs.color}
                    strokeWidth={2}
                    dot={false}
                  />
                  <ReferenceLine
                    x={baselineZero}
                    stroke="#9ca3af"
                    strokeDasharray="3 3"
                    label={{ value: `Baseline zero-tax: ${formatDollarFull(baselineZero)}`, position: 'right', fill: '#6b7280', fontSize: 11 }}
                  />
                  <ReferenceLine
                    x={watcaZero}
                    stroke={fs.color}
                    strokeDasharray="3 3"
                    label={{ value: `WATCA zero-tax: ${formatDollarFull(watcaZero)}`, position: 'right', fill: fs.color, fontSize: 11 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* Surtax brackets */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Millionaire surtax brackets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Single / HOH / Separate</h4>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 border">AGI threshold</th>
                  <th className="text-right p-2 border">Marginal rate</th>
                </tr>
              </thead>
              <tbody>
                {SURTAX_SINGLE.map((b, i) => (
                  <tr key={i}>
                    <td className="p-2 border">{formatDollarFull(b.threshold)}{i < SURTAX_SINGLE.length - 1 ? ` – ${formatDollarFull(SURTAX_SINGLE[i + 1].threshold)}` : '+'}</td>
                    <td className="p-2 border text-right">{(b.rate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Married filing jointly / Surviving spouse</h4>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 border">AGI threshold</th>
                  <th className="text-right p-2 border">Marginal rate</th>
                </tr>
              </thead>
              <tbody>
                {SURTAX_JOINT.map((b, i) => (
                  <tr key={i}>
                    <td className="p-2 border">{formatDollarFull(b.threshold)}{i < SURTAX_JOINT.length - 1 ? ` – ${formatDollarFull(SURTAX_JOINT[i + 1].threshold)}` : '+'}</td>
                    <td className="p-2 border text-right">{(b.rate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="border-t pt-4 text-sm text-gray-500">
        <p className="font-medium mb-1">Sources</p>
        <ul className="space-y-1">
          <li>
            <a
              href="https://x.com/JStein_WaPo/status/2029621495295619363"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:underline"
            >
              Working Americans&apos; Tax Cut Act bill summary (via Jeff Stein, WaPo)
            </a>
          </li>
          <li>
            <a
              href="https://www.washingtonpost.com/business/2026/03/05/middle-class-tax-relief-senate-bill/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:underline"
            >
              Democrat&apos;s plan would eliminate federal income taxes for half of U.S. workers
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
