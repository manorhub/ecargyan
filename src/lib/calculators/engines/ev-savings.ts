/**
 * 5. EV Savings Calculation Engine
 * Formula:
 * Monthly Petrol Cost = (Monthly Distance / Petrol Mileage) × Petrol Price
 * Monthly EV Cost = (Monthly Distance / EV Efficiency) × Electricity Rate
 * Monthly Savings = Monthly Petrol Cost - Monthly EV Cost
 * Annual Savings = (Monthly Savings × 12) + Annual Maintenance Saving
 */

import type { EvSavingsInput, EvSavingsResult } from '../types.ts';
import { roundTo } from '../units.ts';

export function calculateEvSavings(input: EvSavingsInput): EvSavingsResult {
  const {
    monthlyDistanceKm,
    petrolMileageKmPerLitre,
    petrolPricePerLitre,
    evEfficiencyKmPerKwh,
    evElectricityRate,
    annualMaintenanceSaving = 0,
  } = input;

  if (
    monthlyDistanceKm <= 0 ||
    petrolMileageKmPerLitre <= 0 ||
    petrolPricePerLitre < 0 ||
    evEfficiencyKmPerKwh <= 0 ||
    evElectricityRate < 0
  ) {
    return {
      monthlyPetrolCost: 0,
      monthlyEvCost: 0,
      monthlySavings: 0,
      annualSavings: 0,
      threeYearSavings: 0,
      fiveYearSavings: 0,
    };
  }

  const monthlyPetrolCost = (monthlyDistanceKm / petrolMileageKmPerLitre) * petrolPricePerLitre;
  const monthlyEvCost = (monthlyDistanceKm / evEfficiencyKmPerKwh) * evElectricityRate;
  const monthlySavings = monthlyPetrolCost - monthlyEvCost;

  const annualSavings = monthlySavings * 12 + annualMaintenanceSaving;
  const threeYearSavings = annualSavings * 3;
  const fiveYearSavings = annualSavings * 5;

  return {
    monthlyPetrolCost: roundTo(monthlyPetrolCost, 2),
    monthlyEvCost: roundTo(monthlyEvCost, 2),
    monthlySavings: roundTo(monthlySavings, 2),
    annualSavings: roundTo(annualSavings, 2),
    threeYearSavings: roundTo(threeYearSavings, 2),
    fiveYearSavings: roundTo(fiveYearSavings, 2),
  };
}
