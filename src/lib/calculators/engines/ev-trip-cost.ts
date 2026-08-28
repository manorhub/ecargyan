/**
 * 4. EV Trip Cost Calculation Engine
 * Formula:
 * Battery Energy Required = Trip Distance / (km/kWh)
 * Grid Energy Drawn = Battery Energy Required / (Charging Efficiency / 100)
 * Total Trip Cost = Grid Energy Drawn × Electricity Rate
 */

import type { EvTripCostInput, EvTripCostResult } from '../types.ts';
import { toKmPerKwh, roundTo } from '../units.ts';

export function calculateEvTripCost(input: EvTripCostInput): EvTripCostResult {
  const {
    tripDistanceKm,
    efficiencyValue,
    efficiencyUnit,
    electricityRate,
    chargingEfficiencyPercent = 90,
  } = input;

  if (tripDistanceKm <= 0 || efficiencyValue <= 0 || electricityRate < 0) {
    return {
      batteryEnergyRequiredKwh: 0,
      gridEnergyConsumedKwh: 0,
      totalTripCost: 0,
      costPerKm: 0,
    };
  }

  const kmPerKwh = toKmPerKwh(efficiencyValue, efficiencyUnit);
  if (kmPerKwh <= 0) {
    return {
      batteryEnergyRequiredKwh: 0,
      gridEnergyConsumedKwh: 0,
      totalTripCost: 0,
      costPerKm: 0,
    };
  }

  const validEfficiency = Math.max(1, Math.min(100, chargingEfficiencyPercent));
  const efficiencyDecimal = validEfficiency / 100;

  const batteryEnergyRequiredKwh = tripDistanceKm / kmPerKwh;
  const gridEnergyConsumedKwh = batteryEnergyRequiredKwh / efficiencyDecimal;
  const totalTripCost = gridEnergyConsumedKwh * electricityRate;
  const costPerKm = totalTripCost / tripDistanceKm;

  return {
    batteryEnergyRequiredKwh: roundTo(batteryEnergyRequiredKwh, 2),
    gridEnergyConsumedKwh: roundTo(gridEnergyConsumedKwh, 2),
    totalTripCost: roundTo(totalTripCost, 2),
    costPerKm: roundTo(costPerKm, 2),
  };
}
