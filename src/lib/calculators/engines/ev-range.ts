/**
 * 7. EV Range Calculation Engine
 * Formula:
 * Usable Capacity (kWh) = Total Capacity × (Usable Buffer % / 100)
 * Estimated Range (km) = Usable Capacity × (km/kWh)
 * Estimated Range (miles) = Estimated Range (km) × 0.621371
 */

import type { EvRangeInput, EvRangeResult } from '../types.ts';
import { toKmPerKwh, convertDistance, roundTo } from '../units.ts';

export function calculateEvRange(input: EvRangeInput): EvRangeResult {
  const { batteryCapacityKwh, usableCapacityPercent = 95, efficiencyValue, efficiencyUnit } = input;

  if (batteryCapacityKwh <= 0 || efficiencyValue <= 0) {
    return {
      usableCapacityKwh: 0,
      estimatedRangeKm: 0,
      estimatedRangeMiles: 0,
      efficiencyKmPerKwh: 0,
    };
  }

  const validBuffer = Math.max(1, Math.min(100, usableCapacityPercent));
  const usableCapacityKwh = (batteryCapacityKwh * validBuffer) / 100;

  const kmPerKwh = toKmPerKwh(efficiencyValue, efficiencyUnit);
  if (kmPerKwh <= 0) {
    return {
      usableCapacityKwh: 0,
      estimatedRangeKm: 0,
      estimatedRangeMiles: 0,
      efficiencyKmPerKwh: 0,
    };
  }

  const estimatedRangeKm = usableCapacityKwh * kmPerKwh;
  const estimatedRangeMiles = convertDistance(estimatedRangeKm, 'km', 'miles');

  return {
    usableCapacityKwh: roundTo(usableCapacityKwh, 2),
    estimatedRangeKm: roundTo(estimatedRangeKm, 1),
    estimatedRangeMiles: roundTo(estimatedRangeMiles, 1),
    efficiencyKmPerKwh: roundTo(kmPerKwh, 2),
  };
}
