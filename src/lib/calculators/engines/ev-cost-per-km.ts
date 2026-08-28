/**
 * 8. EV Cost Per Km Calculation Engine
 * Formula:
 * Energy per km = 1 / (km/kWh)
 * Cost per km = Energy per km × Electricity Rate
 * Cost per 100 km = Cost per km × 100
 */

import type { EvCostPerKmInput, EvCostPerKmResult } from '../types.ts';
import { toKmPerKwh, roundTo } from '../units.ts';

export function calculateEvCostPerKm(input: EvCostPerKmInput): EvCostPerKmResult {
  const { efficiencyValue, efficiencyUnit, electricityRate } = input;

  if (efficiencyValue <= 0 || electricityRate < 0) {
    return {
      costPerKm: 0,
      costPer100Km: 0,
      energyPerKmKwh: 0,
    };
  }

  const kmPerKwh = toKmPerKwh(efficiencyValue, efficiencyUnit);
  if (kmPerKwh <= 0) {
    return {
      costPerKm: 0,
      costPer100Km: 0,
      energyPerKmKwh: 0,
    };
  }

  const energyPerKmKwh = 1 / kmPerKwh;
  const costPerKm = energyPerKmKwh * electricityRate;
  const costPer100Km = costPerKm * 100;

  return {
    costPerKm: roundTo(costPerKm, 2),
    costPer100Km: roundTo(costPer100Km, 2),
    energyPerKmKwh: roundTo(energyPerKmKwh, 3),
  };
}
