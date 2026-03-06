'use client';

import { useState } from 'react';

interface Props {
  ageHead: number;
  setAgeHead: (v: number) => void;
  ageSpouse: number | null;
  setAgeSpouse: (v: number | null) => void;
  married: boolean;
  setMarried: (v: boolean) => void;
  dependentAges: number[];
  setDependentAges: (v: number[]) => void;
  income: number;
  setIncome: (v: number) => void;
  surtaxEnabled: boolean;
  setSurtaxEnabled: (v: boolean) => void;
  maxEarnings: number;
  setMaxEarnings: (v: number) => void;
  onCalculate: () => void;
  calculationTriggered: boolean;
  hasChanges: boolean;
}

export default function HouseholdForm({
  ageHead,
  setAgeHead,
  ageSpouse,
  setAgeSpouse,
  married,
  setMarried,
  dependentAges,
  setDependentAges,
  income,
  setIncome,
  surtaxEnabled,
  setSurtaxEnabled,
  maxEarnings,
  setMaxEarnings,
  onCalculate,
  calculationTriggered,
  hasChanges,
}: Props) {
  const [expandedStep, setExpandedStep] = useState<number>(1);

  const handleMarriedChange = (value: boolean) => {
    setMarried(value);
    if (!value) {
      setAgeSpouse(null);
    } else {
      setAgeSpouse(35);
    }
  };

  const handleDependentCountChange = (count: number) => {
    const currentAges = [...dependentAges];
    if (count > currentAges.length) {
      while (currentAges.length < count) {
        currentAges.push(5);
      }
    } else {
      currentAges.splice(count);
    }
    setDependentAges(currentAges);
  };

  const handleDependentAgeChange = (index: number, age: number) => {
    const newAges = [...dependentAges];
    newAges[index] = age;
    setDependentAges(newAges);
  };

  const toggleStep = (step: number) => {
    setExpandedStep(expandedStep === step ? 0 : step);
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

  const parseNumber = (str: string): number => {
    const cleaned = str.replace(/,/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const StepHeader = ({
    stepNumber,
    title,
    isExpanded,
  }: {
    stepNumber: number;
    title: string;
    isExpanded: boolean;
  }) => (
    <button
      onClick={() => toggleStep(stepNumber)}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
        isExpanded
          ? 'bg-primary-50 border-2 border-primary-500'
          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div
          className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center font-semibold ${
            isExpanded
              ? 'bg-primary-500 text-white'
              : 'bg-gray-300 text-gray-600'
          }`}
        >
          {stepNumber}
        </div>
        <span
          className={`font-semibold ${
            isExpanded ? 'text-primary-600' : 'text-gray-700'
          }`}
        >
          {title}
        </span>
      </div>
      <svg
        className={`w-5 h-5 transition-transform ${
          isExpanded ? 'rotate-180 text-primary-500' : 'text-gray-400'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );

  return (
    <div className="sticky top-4 space-y-4">
      {/* Step 1: Household & Income */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <StepHeader stepNumber={1} title="Household & Income" isExpanded={expandedStep === 1} />

        {expandedStep === 1 && (
          <div className="px-4 pb-4 pt-3 space-y-4">
            {/* AGI */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjusted Gross Income (AGI)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="text"
                  value={formatNumber(income)}
                  onChange={(e) => setIncome(parseNumber(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Your annual adjusted gross income</p>
            </div>

            {/* Married */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="married"
                checked={married}
                onChange={(e) => handleMarriedChange(e.target.checked)}
                className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="married" className="text-sm font-medium text-gray-700">
                Married filing jointly
              </label>
            </div>

            {/* Ages */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Age
                </label>
                <input
                  type="number"
                  value={ageHead}
                  onChange={(e) =>
                    setAgeHead(Math.max(18, Math.min(100, parseInt(e.target.value) || 18)))
                  }
                  min={18}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {married && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spouse Age
                  </label>
                  <input
                    type="number"
                    value={ageSpouse ?? 35}
                    onChange={(e) =>
                      setAgeSpouse(Math.max(18, Math.min(100, parseInt(e.target.value) || 18)))
                    }
                    min={18}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Dependents */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Dependents
              </label>
              <input
                type="number"
                value={dependentAges.length}
                onChange={(e) =>
                  handleDependentCountChange(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))
                }
                min={0}
                max={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {dependentAges.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dependent Ages
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {dependentAges.map((age, i) => (
                    <input
                      key={i}
                      type="number"
                      value={age}
                      onChange={(e) =>
                        handleDependentAgeChange(i, Math.max(0, Math.min(26, parseInt(e.target.value) || 0)))
                      }
                      min={0}
                      max={26}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      placeholder={`Dep ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Reform Options */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <StepHeader stepNumber={2} title="Reform Options" isExpanded={expandedStep === 2} />

        {expandedStep === 2 && (
          <div className="px-4 pb-4 pt-3 space-y-4">
            <p className="text-sm text-gray-600">
              The cost-of-living exemption is always applied. Toggle the millionaire surtax below.
            </p>

            {/* Surtax Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="font-semibold text-gray-800 text-sm">
                  Millionaire Surtax
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  5-12% marginal surtax on AGI above $1M
                </p>
              </div>
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
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Chart Options */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <StepHeader stepNumber={3} title="Chart Options" isExpanded={expandedStep === 3} />

        {expandedStep === 3 && (
          <div className="px-4 pb-4 pt-3 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Earnings (X-Axis)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="text"
                  value={formatNumber(maxEarnings)}
                  onChange={(e) => setMaxEarnings(Math.max(10000, parseNumber(e.target.value)))}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Sets the x-axis limit on the household impact chart
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[200000, 500000, 1000000, 2000000].map((v) => (
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
          </div>
        )}
      </div>

      {/* Calculate Button */}
      <button
        onClick={onCalculate}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors shadow-md ${
          calculationTriggered && hasChanges
            ? 'bg-primary-600 hover:bg-primary-700 animate-pulse'
            : 'bg-primary-500 hover:bg-primary-600'
        }`}
      >
        {calculationTriggered && hasChanges ? 'Recalculate' : 'Calculate Impact'}
      </button>
    </div>
  );
}
