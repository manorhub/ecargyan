/**
 * 3. EV vs Petrol Cost Comparison Calculation Engine
 * Formula:
 * EV Cost/km = (1 / (km/kWh)) × Electricity Rate
 * Petrol Cost/km = Petrol Price / Petrol Mileage (km/L)
 * Difference/km = Petrol Cost/km - EV Cost/km
 */

import type { EvVsPetrolCostInput, EvVsPetrolCostResult } from '../types.ts';
import { toKmPerKwh, roundTo } from '../units.ts';

export function calculateEvVsPetrolCost(input: EvVsPetrolCostInput): EvVsPetrolCostResult {
  const {
    evEfficiencyValue,
    evEfficiencyUnit,
    evElectricityRate,
    petrolMileageKmPerLitre,
    petrolPricePerLitre,
    distanceKm,
  } = input;

  if (
    evEfficiencyValue <= 0 ||
    evElectricityRate < 0 ||
    petrolMileageKmPerLitre <= 0 ||
    petrolPricePerLitre < 0 ||
    distanceKm < 0
  ) {
    return {
      evCostPerKm: 0,
      petrolCostPerKm: 0,
      differencePerKm: 0,
      savingsPercent: 0,
      tripEvCost: 0,
      tripPetrolCost: 0,
      tripSavings: 0,
      monthlySavings: 0,
      annualSavings: 0,
    };
  }

  const evKmPerKwh = toKmPerKwh(evEfficiencyValue, evEfficiencyUnit);
  if (evKmPerKwh <= 0) {
    return {
      evCostPerKm: 0,
      petrolCostPerKm: 0,
      differencePerKm: 0,
      savingsPercent: 0,
      tripEvCost: 0,
      tripPetrolCost: 0,
      tripSavings: 0,
      monthlySavings: 0,
      annualSavings: 0,
    };
  }

  const evCostPerKm = (1 / evKmPerKwh) * evElectricityRate;
  const petrolCostPerKm = petrolPricePerLitre / petrolMileageKmPerLitre;
  const differencePerKm = petrolCostPerKm - evCostPerKm;
  const savingsPercent = petrolCostPerKm > 0 ? (differencePerKm / petrolCostPerKm) * 100 : 0;

  const tripEvCost = evCostPerKm * distanceKm;
  const tripPetrolCost = petrolCostPerKm * distanceKm;
  const tripSavings = tripPetrolCost - tripEvCost;

  // Standard monthly (assuming distance is monthly, or scaling by standard 1200 km if single trip < 100km)
  const effectiveMonthlyDistance = distanceKm > 100 ? distanceKm : distanceKm * 30;
  const monthlySavings = differencePerKm * effectiveMonthlyDistance;
  const annualSavings = monthlySavings * 12;

  return {
    evCostPerKm: roundTo(evCostPerKm, 2),
    petrolCostPerKm: roundTo(petrolCostPerKm, 2),
    differencePerKm: roundTo(differencePerKm, 2),
    savingsPercent: roundTo(savingsPercent, 1),
    tripEvCost: roundTo(tripEvCost, 2),
    tripPetrolCost: roundTo(tripPetrolCost, 2),
    tripSavings: roundTo(tripSavings, 2),
    monthlySavings: roundTo(monthlySavings, 2),
    annualSavings: roundTo(annualSavings, 2),
  };
}
