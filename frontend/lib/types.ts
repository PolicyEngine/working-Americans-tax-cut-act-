export interface ReformParams {
  surtax_enabled: boolean;
}

export interface HouseholdRequest {
  age_head: number;
  age_spouse: number | null;
  dependent_ages: number[];
  income: number;
  year: number;
  reform_params: ReformParams;
}

export interface BenefitAtIncome {
  baseline: number;
  reform: number;
  difference: number;
}

export interface HouseholdImpactResponse {
  income_range: number[];
  net_income_change: number[];
  benefit_at_income: BenefitAtIncome;
  x_axis_max: number;
}

export interface IncomeBracket {
  bracket: string;
  beneficiaries: number;
  total_cost: number;
  avg_benefit: number;
}

export interface AggregateImpactResponse {
  total_cost: number;
  beneficiaries: number;
  avg_benefit: number;
  winners: number;
  losers: number;
  winners_rate: number;
  losers_rate: number;
  poverty_baseline_rate: number;
  poverty_reform_rate: number;
  poverty_rate_change: number;
  poverty_percent_change: number;
  child_poverty_baseline_rate: number;
  child_poverty_reform_rate: number;
  child_poverty_rate_change: number;
  child_poverty_percent_change: number;
  deep_poverty_baseline_rate: number;
  deep_poverty_reform_rate: number;
  deep_poverty_rate_change: number;
  deep_poverty_percent_change: number;
  deep_child_poverty_baseline_rate: number;
  deep_child_poverty_reform_rate: number;
  deep_child_poverty_rate_change: number;
  deep_child_poverty_percent_change: number;
  by_income_bracket: IncomeBracket[];
}

export interface HealthResponse {
  status: string;
  version: string;
}
