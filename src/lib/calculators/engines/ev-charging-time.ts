/**
 * 6. EV Charging Time Calculation Engine
 * Formula:
 * Energy Needed (kWh) = Battery Capacity × ((Target SOC - Current SOC) / 100)
 * Effective Power (kW) = Charger Power × (Charging Efficiency / 100)
 * Estimated Charging Time (hours) = Energy Needed / Effective Power
 */

import type { EvChargingTimeInput, EvChargingTimeResult } from '../types.ts';
import { formatHoursAndMinutes, roundTo } from '../units.ts';

export function calculateEvChargingTime(input: EvChargingTimeInput): EvChargingTimeResult {
  const {
    batteryCapacityKwh,
    currentSocPercent,
    targetSocPercent,
    chargerPowerKw,
    chargingEfficiencyPercent,
  } = input;

  if (batteryCapacityKwh <= 0 || chargerPowerKw <= 0) {
    return {
      energyNeededKwh: 0,
      effectiveChargingPowerKw: 0,
      chargingTimeHours: 0,
      chargingTimeFormatted: '0m',
      hours: 0,
      minutes: 0,
    };
  }

  const validCurrentSoc = Math.max(0, Math.min(100, currentSocPercent));
  const validTargetSoc = Math.max(validCurrentSoc, Math.min(100, targetSocPercent));
  const socDelta = validTargetSoc - validCurrentSoc;

  const validEfficiency = Math.max(1, Math.min(100, chargingEfficiencyPercent || 90));
  const efficiencyDecimal = validEfficiency / 100;

  const energyNeededKwh = (batteryCapacityKwh * socDelta) / 100;
  const effectiveChargingPowerKw = chargerPowerKw * efficiencyDecimal;
  const chargingTimeHours = effectiveChargingPowerKw > 0 ? energyNeededKwh / effectiveChargingPowerKw : 0;

  const { formatted, hours, minutes } = formatHoursAndMinutes(chargingTimeHours);

  return {
    energyNeededKwh: roundTo(energyNeededKwh, 2),
    effectiveChargingPowerKw: roundTo(effectiveChargingPowerKw, 2),
    chargingTimeHours: roundTo(chargingTimeHours, 2),
    chargingTimeFormatted: formatted,
    hours,
    minutes,
  };
}
