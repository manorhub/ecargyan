/**
 * 1. EV Charging Cost Calculation Engine
 * Formula:
 * Battery Energy Added = Capacity × ((Target SOC - Current SOC) / 100)
 * Grid Energy Drawn = Battery Energy Added / (Charging Efficiency / 100)
 * Total Cost = Grid Energy Drawn × Electricity Rate
 */

import type { EvChargingCostInput, EvChargingCostResult } from '../types.ts';
import { roundTo } from '../units.ts';

export function calculateEvChargingCost(input: EvChargingCostInput): EvChargingCostResult {
  const {
    batteryCapacityKwh,
    currentSocPercent,
    targetSocPercent,
    chargingEfficiencyPercent,
    electricityRate,
  } = input;

  // Validation bounds
  if (batteryCapacityKwh <= 0 || electricityRate < 0) {
    return {
      batteryEnergyAddedKwh: 0,
      gridEnergyConsumedKwh: 0,
      estimatedCost: 0,
      costPerKwhAdded: 0,
      energyLossKwh: 0,
    };
  }

  const validCurrentSoc = Math.max(0, Math.min(100, currentSocPercent));
  const validTargetSoc = Math.max(validCurrentSoc, Math.min(100, targetSocPercent));
  const socDelta = validTargetSoc - validCurrentSoc;

  const validEfficiency = Math.max(1, Math.min(100, chargingEfficiencyPercent || 90));
  const efficiencyDecimal = validEfficiency / 100;

  const batteryEnergyAddedKwh = (batteryCapacityKwh * socDelta) / 100;
  const gridEnergyConsumedKwh = batteryEnergyAddedKwh / efficiencyDecimal;
  const estimatedCost = gridEnergyConsumedKwh * electricityRate;
  const energyLossKwh = Math.max(0, gridEnergyConsumedKwh - batteryEnergyAddedKwh);
  const costPerKwhAdded = batteryEnergyAddedKwh > 0 ? estimatedCost / batteryEnergyAddedKwh : 0;

  return {
    batteryEnergyAddedKwh: roundTo(batteryEnergyAddedKwh, 2),
    gridEnergyConsumedKwh: roundTo(gridEnergyConsumedKwh, 2),
    estimatedCost: roundTo(estimatedCost, 2),
    costPerKwhAdded: roundTo(costPerKwhAdded, 2),
    energyLossKwh: roundTo(energyLossKwh, 2),
  };
}
