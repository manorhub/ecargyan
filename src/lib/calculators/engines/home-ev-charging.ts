/**
 * 9. Home EV Charging Calculation Engine
 * Formula:
 * Battery Energy Added = Capacity × ((Target SOC - Current SOC) / 100)
 * Grid Energy Drawn = Battery Energy Added / (Charging Efficiency / 100)
 * Total Cost = Grid Energy Drawn × Home Electricity Tariff
 * Approximate Charging Time = Battery Energy Added / (Charger Power × Efficiency)
 */

import type { HomeEvChargingInput, HomeEvChargingResult } from '../types.ts';
import { formatHoursAndMinutes, roundTo } from '../units.ts';

export function calculateHomeEvCharging(input: HomeEvChargingInput): HomeEvChargingResult {
  const {
    batteryCapacityKwh,
    currentSocPercent,
    targetSocPercent,
    homeElectricityRate,
    chargerPowerKw,
    chargingEfficiencyPercent,
  } = input;

  if (batteryCapacityKwh <= 0 || chargerPowerKw <= 0 || homeElectricityRate < 0) {
    return {
      batteryEnergyAddedKwh: 0,
      gridEnergyConsumedKwh: 0,
      totalChargingCost: 0,
      approximateTimeHours: 0,
      approximateTimeFormatted: '0m',
    };
  }

  const validCurrentSoc = Math.max(0, Math.min(100, currentSocPercent));
  const validTargetSoc = Math.max(validCurrentSoc, Math.min(100, targetSocPercent));
  const socDelta = validTargetSoc - validCurrentSoc;

  const validEfficiency = Math.max(1, Math.min(100, chargingEfficiencyPercent || 90));
  const efficiencyDecimal = validEfficiency / 100;

  const batteryEnergyAddedKwh = (batteryCapacityKwh * socDelta) / 100;
  const gridEnergyConsumedKwh = batteryEnergyAddedKwh / efficiencyDecimal;
  const totalChargingCost = gridEnergyConsumedKwh * homeElectricityRate;

  const effectivePowerKw = chargerPowerKw * efficiencyDecimal;
  const approximateTimeHours = effectivePowerKw > 0 ? batteryEnergyAddedKwh / effectivePowerKw : 0;
  const { formatted } = formatHoursAndMinutes(approximateTimeHours);

  return {
    batteryEnergyAddedKwh: roundTo(batteryEnergyAddedKwh, 2),
    gridEnergyConsumedKwh: roundTo(gridEnergyConsumedKwh, 2),
    totalChargingCost: roundTo(totalChargingCost, 2),
    approximateTimeHours: roundTo(approximateTimeHours, 2),
    approximateTimeFormatted: formatted,
  };
}
