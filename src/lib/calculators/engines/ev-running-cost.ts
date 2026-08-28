/**
 * 2. EV Running Cost Calculation Engine
 * Formula:
 * Energy per km (kWh/km) = 1 / (km/kWh)
 * Cost per km = Energy per km × Electricity Rate
 * Cost per 100 km = Cost per km × 100
 */

import type { EvRunningCostInput, EvRunningCostResult } from '../types.ts';
import { toKmPerKwh, roundTo } from '../units.ts';

export function calculateEvRunningCost(input: EvRunningCostInput): EvRunningCostResult {
  const { efficiencyValue, efficiencyUnit, electricityRate, distance, distancePeriod } = input;

  if (efficiencyValue <= 0 || electricityRate < 0 || distance < 0) {
    return {
      costPerKm: 0,
      costPer100Km: 0,
      periodCost: 0,
      dailyCost: 0,
      monthlyCost: 0,
      annualCost: 0,
      energyConsumedKwh: 0,
    };
  }

  const kmPerKwh = toKmPerKwh(efficiencyValue, efficiencyUnit);
  if (kmPerKwh <= 0) {
    return {
      costPerKm: 0,
      costPer100Km: 0,
      periodCost: 0,
      dailyCost: 0,
      monthlyCost: 0,
      annualCost: 0,
      energyConsumedKwh: 0,
    };
  }

  const energyPerKm = 1 / kmPerKwh;
  const costPerKm = energyPerKm * electricityRate;
  const costPer100Km = costPerKm * 100;
  const energyConsumedKwh = distance * energyPerKm;
  const periodCost = costPerKm * distance;

  let dailyCost = 0;
  let monthlyCost = 0;
  let annualCost = 0;

  switch (distancePeriod) {
    case 'daily':
      dailyCost = periodCost;
      monthlyCost = dailyCost * 30.42;
      annualCost = dailyCost * 365;
      break;
    case 'monthly':
      monthlyCost = periodCost;
      dailyCost = monthlyCost / 30.42;
      annualCost = monthlyCost * 12;
      break;
    case 'annual':
      annualCost = periodCost;
      monthlyCost = annualCost / 12;
      dailyCost = annualCost / 365;
      break;
    case 'trip':
    default:
      dailyCost = periodCost;
      monthlyCost = periodCost * 30.42;
      annualCost = periodCost * 365;
      break;
  }

  return {
    costPerKm: roundTo(costPerKm, 2),
    costPer100Km: roundTo(costPer100Km, 2),
    periodCost: roundTo(periodCost, 2),
    dailyCost: roundTo(dailyCost, 2),
    monthlyCost: roundTo(monthlyCost, 2),
    annualCost: roundTo(annualCost, 2),
    energyConsumedKwh: roundTo(energyConsumedKwh, 2),
  };
}
