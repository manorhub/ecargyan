/**
 * ECargyan.com — EV Calculator System Types & Interfaces
 * Pure, deterministic TypeScript definitions for all EV calculation engines.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'AUD' | 'CAD';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
}

export type DistanceUnit = 'km' | 'miles';
export type EfficiencyUnit = 'km/kWh' | 'Wh/km' | 'kWh/100km' | 'mi/kWh';
export type SpeedUnit = 'km/h' | 'mph';

export type CalculatorCategory = 'charging' | 'running-costs' | 'range' | 'ownership' | 'savings';

export interface CalculatorFaq {
  question: string;
  answer: string;
}

export interface CalculatorExample {
  title: string;
  description: string;
  inputs: Record<string, string | number>;
  expectedOutput: string;
  notes?: string;
}

export interface CalculatorMeta {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  tagline: string;
  category: CalculatorCategory;
  categoryName: string;
  metaDescription: string;
  primaryResultLabel: string;
  primaryResultUnit?: string;
  formulaDescription: string;
  formulaSteps: string[];
  example: CalculatorExample;
  faqs: CalculatorFaq[];
  relatedSlugs: string[];
  disclaimer: string;
  published: boolean;
}

// 1. EV Charging Cost
export interface EvChargingCostInput {
  batteryCapacityKwh: number;
  currentSocPercent: number;
  targetSocPercent: number;
  chargingEfficiencyPercent: number;
  electricityRate: number;
}

export interface EvChargingCostResult {
  batteryEnergyAddedKwh: number;
  gridEnergyConsumedKwh: number;
  estimatedCost: number;
  costPerKwhAdded: number;
  energyLossKwh: number;
}

// 2. EV Running Cost
export interface EvRunningCostInput {
  efficiencyValue: number;
  efficiencyUnit: EfficiencyUnit;
  electricityRate: number;
  distance: number;
  distancePeriod: 'trip' | 'daily' | 'monthly' | 'annual';
}

export interface EvRunningCostResult {
  costPerKm: number;
  costPer100Km: number;
  periodCost: number;
  dailyCost: number;
  monthlyCost: number;
  annualCost: number;
  energyConsumedKwh: number;
}

// 3. EV vs Petrol Cost
export interface EvVsPetrolCostInput {
  evEfficiencyValue: number;
  evEfficiencyUnit: EfficiencyUnit;
  evElectricityRate: number;
  petrolMileageKmPerLitre: number;
  petrolPricePerLitre: number;
  distanceKm: number;
}

export interface EvVsPetrolCostResult {
  evCostPerKm: number;
  petrolCostPerKm: number;
  differencePerKm: number;
  savingsPercent: number;
  tripEvCost: number;
  tripPetrolCost: number;
  tripSavings: number;
  monthlySavings: number;
  annualSavings: number;
}

// 4. EV Trip Cost
export interface EvTripCostInput {
  tripDistanceKm: number;
  efficiencyValue: number;
  efficiencyUnit: EfficiencyUnit;
  electricityRate: number;
  chargingEfficiencyPercent?: number;
}

export interface EvTripCostResult {
  batteryEnergyRequiredKwh: number;
  gridEnergyConsumedKwh: number;
  totalTripCost: number;
  costPerKm: number;
}

// 5. EV Savings
export interface EvSavingsInput {
  monthlyDistanceKm: number;
  petrolMileageKmPerLitre: number;
  petrolPricePerLitre: number;
  evEfficiencyKmPerKwh: number;
  evElectricityRate: number;
  annualMaintenanceSaving?: number;
}

export interface EvSavingsResult {
  monthlyPetrolCost: number;
  monthlyEvCost: number;
  monthlySavings: number;
  annualSavings: number;
  threeYearSavings: number;
  fiveYearSavings: number;
}

// 6. EV Charging Time
export interface EvChargingTimeInput {
  batteryCapacityKwh: number;
  currentSocPercent: number;
  targetSocPercent: number;
  chargerPowerKw: number;
  chargingEfficiencyPercent: number;
}

export interface EvChargingTimeResult {
  energyNeededKwh: number;
  effectiveChargingPowerKw: number;
  chargingTimeHours: number;
  chargingTimeFormatted: string;
  hours: number;
  minutes: number;
}

// 7. EV Range
export interface EvRangeInput {
  batteryCapacityKwh: number;
  usableCapacityPercent?: number;
  efficiencyValue: number;
  efficiencyUnit: EfficiencyUnit;
}

export interface EvRangeResult {
  usableCapacityKwh: number;
  estimatedRangeKm: number;
  estimatedRangeMiles: number;
  efficiencyKmPerKwh: number;
}

// 8. EV Cost Per Km
export interface EvCostPerKmInput {
  efficiencyValue: number;
  efficiencyUnit: EfficiencyUnit;
  electricityRate: number;
}

export interface EvCostPerKmResult {
  costPerKm: number;
  costPer100Km: number;
  energyPerKmKwh: number;
}

// 9. Home EV Charging
export interface HomeEvChargingInput {
  batteryCapacityKwh: number;
  currentSocPercent: number;
  targetSocPercent: number;
  homeElectricityRate: number;
  chargerPowerKw: number;
  chargingEfficiencyPercent: number;
}

export interface HomeEvChargingResult {
  batteryEnergyAddedKwh: number;
  gridEnergyConsumedKwh: number;
  totalChargingCost: number;
  approximateTimeHours: number;
  approximateTimeFormatted: string;
}

// 10. EV Battery Degradation
export interface EvBatteryDegradationInput {
  initialCapacityKwh: number;
  annualDegradationRatePercent: number;
  years: number;
}

export interface EvBatteryDegradationYearResult {
  year: number;
  remainingCapacityKwh: number;
  retentionPercent: number;
  lostCapacityKwh: number;
}

export interface EvBatteryDegradationResult {
  projectedCapacityKwh: number;
  retentionPercent: number;
  totalLostCapacityKwh: number;
  yearlyBreakdown: EvBatteryDegradationYearResult[];
}

// 11. EV Total Cost of Ownership (TCO)
export interface EvTcoInput {
  vehiclePurchasePrice: number;
  annualDistanceKm: number;
  ownershipYears: number;
  evEfficiencyKmPerKwh: number;
  electricityRate: number;
  annualInsurance: number;
  annualMaintenance: number;
  registrationAndTaxes: number;
  expectedResaleValuePercent: number;
  totalFinancingInterest?: number;
}

export interface EvTcoResult {
  totalPurchaseCost: number;
  totalEnergyCost: number;
  totalMaintenanceCost: number;
  totalInsuranceCost: number;
  totalTaxesAndFees: number;
  totalFinancingCost: number;
  estimatedResaleValue: number;
  netOwnershipCost: number;
  costPerYear: number;
  costPerMonth: number;
  costPerKm: number;
}

// 12. EV Break-Even
export interface EvBreakEvenInput {
  evPurchasePrice: number;
  petrolPurchasePrice: number;
  evCostPerKm: number;
  petrolCostPerKm: number;
  annualDistanceKm: number;
}

export interface EvBreakEvenResult {
  purchasePremium: number;
  runningCostSavingsPerKm: number;
  breakEvenDistanceKm: number;
  breakEvenYears: number;
  breakEvenMonths: number;
  isImmediatelyCheaper: boolean;
}
