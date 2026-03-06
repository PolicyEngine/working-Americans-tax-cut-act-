'use client';

import { useState, useEffect } from 'react';
import HouseholdForm from '@/components/HouseholdForm';
import ImpactAnalysis from '@/components/ImpactAnalysis';
import AggregateImpact from '@/components/AggregateImpact';
import type { HouseholdRequest } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'impact' | 'aggregate'>('impact');
  const [calculationTriggered, setCalculationTriggered] = useState(false);

  // Household configuration
  const [ageHead, setAgeHead] = useState(35);
  const [ageSpouse, setAgeSpouse] = useState<number | null>(null);
  const [married, setMarried] = useState(false);
  const [dependentAges, setDependentAges] = useState<number[]>([]);
  const [income, setIncome] = useState(75000);

  // Reform state
  const [surtaxEnabled, setSurtaxEnabled] = useState(true);

  // Last calculated values
  const [calculatedAgeHead, setCalculatedAgeHead] = useState(35);
  const [calculatedAgeSpouse, setCalculatedAgeSpouse] = useState<number | null>(null);
  const [calculatedMarried, setCalculatedMarried] = useState(false);
  const [calculatedDependentAges, setCalculatedDependentAges] = useState<number[]>([]);
  const [calculatedIncome, setCalculatedIncome] = useState(75000);
  const [calculatedSurtaxEnabled, setCalculatedSurtaxEnabled] = useState(true);

  const hasChanges =
    ageHead !== calculatedAgeHead ||
    ageSpouse !== calculatedAgeSpouse ||
    married !== calculatedMarried ||
    JSON.stringify(dependentAges) !== JSON.stringify(calculatedDependentAges) ||
    income !== calculatedIncome ||
    surtaxEnabled !== calculatedSurtaxEnabled;

  const handleCalculate = () => {
    setCalculationTriggered(true);
    setCalculatedAgeHead(ageHead);
    setCalculatedAgeSpouse(ageSpouse);
    setCalculatedMarried(married);
    setCalculatedDependentAges(dependentAges);
    setCalculatedIncome(income);
    setCalculatedSurtaxEnabled(surtaxEnabled);
  };

  // Auto-calculate on first load
  useEffect(() => {
    handleCalculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calcRequest: HouseholdRequest = {
    age_head: calculatedAgeHead,
    age_spouse: calculatedMarried ? calculatedAgeSpouse : null,
    dependent_ages: calculatedDependentAges,
    income: calculatedIncome,
    year: 2026,
    reform_params: { surtax_enabled: calculatedSurtaxEnabled },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-8 px-4 shadow-md">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">
            Working Americans&apos; Tax Cut Act Calculator
          </h1>
          <p className="text-lg opacity-90">
            Estimate the impact of the cost-of-living exemption and millionaire surtax on your household and the nation
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar: Configuration Form */}
          <div className="lg:col-span-1">
            <HouseholdForm
              ageHead={ageHead}
              setAgeHead={setAgeHead}
              ageSpouse={ageSpouse}
              setAgeSpouse={setAgeSpouse}
              married={married}
              setMarried={setMarried}
              dependentAges={dependentAges}
              setDependentAges={setDependentAges}
              income={income}
              setIncome={setIncome}
              surtaxEnabled={surtaxEnabled}
              setSurtaxEnabled={setSurtaxEnabled}
              onCalculate={handleCalculate}
              calculationTriggered={calculationTriggered}
              hasChanges={hasChanges}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {!calculationTriggered ? (
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold text-primary mb-4">Get Started</h2>
                <p className="text-gray-700 mb-4">
                  Configure your household in the sidebar, then click{' '}
                  <span className="font-semibold">&ldquo;Calculate Impact&rdquo;</span> to see:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>How the Working Americans&apos; Tax Cut Act would affect your household</li>
                  <li>The impact across different income levels</li>
                  <li>National aggregate impact across all US households</li>
                </ul>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex space-x-1 mb-4">
                  <button
                    onClick={() => setActiveTab('impact')}
                    className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
                      activeTab === 'impact'
                        ? 'bg-white text-primary-600 border-t-4 border-primary-500'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Impact Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab('aggregate')}
                    className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
                      activeTab === 'aggregate'
                        ? 'bg-white text-primary-600 border-t-4 border-primary-500'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    National Impact
                  </button>
                </div>

                {/* Tab Content */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  {activeTab === 'impact' ? (
                    <ImpactAnalysis
                      request={calcRequest}
                      triggered={calculationTriggered}
                    />
                  ) : (
                    <AggregateImpact
                      surtaxEnabled={calculatedSurtaxEnabled}
                      triggered={calculationTriggered}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
