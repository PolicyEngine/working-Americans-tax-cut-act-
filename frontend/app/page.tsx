'use client';

import { useState, useEffect } from 'react';
import ImpactAnalysis from '@/components/ImpactAnalysis';
import AggregateImpact from '@/components/AggregateImpact';
import PolicyOverview from '@/components/PolicyOverview';
import type { HouseholdRequest } from '@/lib/types';

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<'policy' | 'impact' | 'aggregate'>('policy');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-8 px-4 shadow-md">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">
            Working Americans&apos; Tax Cut Act Calculator
          </h1>
          <p className="text-lg opacity-90">
            Estimate the impact of the cost-of-living exemption and millionaire surtax
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 mb-4">
          {(['policy', 'impact', 'aggregate'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-white text-primary-600 border-t-4 border-primary-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab === 'policy'
                ? 'Policy overview'
                : tab === 'impact'
                ? 'Household impact'
                : 'National impact'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {activeTab === 'policy' ? (
            <PolicyOverview />
          ) : activeTab === 'impact' ? (
            <HouseholdImpactTab />
          ) : (
            <NationalImpactTab />
          )}
        </div>
      </div>
    </div>
  );
}

/** Household impact tab — includes inline household config */
function HouseholdImpactTab() {
  const [ageHead, setAgeHead] = useState(35);
  const [ageSpouse, setAgeSpouse] = useState<number | null>(null);
  const [married, setMarried] = useState(false);
  const [dependentAges, setDependentAges] = useState<number[]>([]);
  const [income, setIncome] = useState(75000);
  const [surtaxEnabled, setSurtaxEnabled] = useState(true);
  const [stateCode, setStateCode] = useState('CA');
  const [maxEarnings, setMaxEarnings] = useState(500000);
  const [triggered, setTriggered] = useState(false);

  const handleMarriedChange = (value: boolean) => {
    setMarried(value);
    if (!value) setAgeSpouse(null);
    else setAgeSpouse(35);
  };

  const handleDependentCountChange = (count: number) => {
    const ages = [...dependentAges];
    while (ages.length < count) ages.push(5);
    ages.splice(count);
    setDependentAges(ages);
  };

  const formatNumber = (num: number) => num.toLocaleString('en-US');
  const parseNumber = (str: string) => {
    const num = Number(str.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const request: HouseholdRequest = {
    age_head: ageHead,
    age_spouse: married ? ageSpouse : null,
    dependent_ages: dependentAges,
    income,
    year: 2026,
    max_earnings: maxEarnings,
    state_code: stateCode,
    reform_params: { surtax_enabled: surtaxEnabled },
  };

  // Auto-calculate on mount
  useEffect(() => {
    setTriggered(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Inline household config */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your household</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* AGI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adjusted gross income
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="text"
                value={formatNumber(income)}
                onChange={(e) => {
                  setIncome(parseNumber(e.target.value));
                  setTriggered(true);
                }}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your age</label>
            <input
              type="number"
              value={ageHead}
              onChange={(e) => {
                setAgeHead(Math.max(18, Math.min(100, parseInt(e.target.value) || 18)));
                setTriggered(true);
              }}
              min={18}
              max={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Married + spouse age */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filing status</label>
            <div className="flex items-center space-x-2 py-2">
              <input
                type="checkbox"
                id="married"
                checked={married}
                onChange={(e) => {
                  handleMarriedChange(e.target.checked);
                  setTriggered(true);
                }}
                className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="married" className="text-sm text-gray-700">
                Married filing jointly
              </label>
            </div>
            {married && (
              <input
                type="number"
                value={ageSpouse ?? 35}
                onChange={(e) => {
                  setAgeSpouse(Math.max(18, Math.min(100, parseInt(e.target.value) || 18)));
                  setTriggered(true);
                }}
                min={18}
                max={100}
                placeholder="Spouse age"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            )}
          </div>

          {/* Dependents */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dependents</label>
            <input
              type="number"
              value={dependentAges.length}
              onChange={(e) => {
                handleDependentCountChange(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)));
                setTriggered(true);
              }}
              min={0}
              max={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {dependentAges.length > 0 && (
              <div className="grid grid-cols-3 gap-1 mt-2">
                {dependentAges.map((age, i) => (
                  <input
                    key={i}
                    type="number"
                    value={age}
                    onChange={(e) => {
                      const newAges = [...dependentAges];
                      newAges[i] = Math.max(0, Math.min(26, parseInt(e.target.value) || 0));
                      setDependentAges(newAges);
                      setTriggered(true);
                    }}
                    min={0}
                    max={26}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder={`Age ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              value={stateCode}
              onChange={(e) => {
                setStateCode(e.target.value);
                setTriggered(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Surtax toggle — inline */}
        <div className="flex items-center space-x-3 mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              setSurtaxEnabled(!surtaxEnabled);
              setTriggered(true);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              surtaxEnabled ? 'bg-primary-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                surtaxEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">
            Include millionaire surtax (5–12% on AGI above $1M)
          </span>
        </div>
      </div>

      {/* Chart x-axis options */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Chart x-axis max:</span>
        {[200000, 500000, 1000000, 2000000, 5000000, 10000000].map((v) => (
          <button
            key={v}
            onClick={() => setMaxEarnings(v)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              maxEarnings === v
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ${v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}
          </button>
        ))}
      </div>

      {/* Impact results */}
      <ImpactAnalysis request={request} triggered={triggered} maxEarnings={maxEarnings} />
    </div>
  );
}

/** National impact tab — includes surtax toggle */
function NationalImpactTab() {
  const [surtaxEnabled, setSurtaxEnabled] = useState(true);

  return (
    <div className="space-y-6">
      {/* Surtax toggle */}
      <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <button
          onClick={() => setSurtaxEnabled(!surtaxEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            surtaxEnabled ? 'bg-primary-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              surtaxEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm text-gray-700">
          Include millionaire surtax (5–12% marginal surtax on AGI above $1M/$1.5M)
        </span>
      </div>

      <AggregateImpact surtaxEnabled={surtaxEnabled} triggered={true} />
    </div>
  );
}
