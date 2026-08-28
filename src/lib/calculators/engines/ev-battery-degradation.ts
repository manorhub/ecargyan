/**
 * 10. EV Battery Degradation Calculation Engine
 * Formula:
 * Year-over-Year Retention = (1 - Annual Degradation Rate)^Years
 * Projected Capacity = Initial Capacity × Retention Ratio
 * Total Lost Capacity = Initial Capacity - Projected Capacity
 */

import type {
  EvBatteryDegradationInput,
  EvBatteryDegradationResult,
  EvBatteryDegradationYearResult,
} from '../types.ts';
import { roundTo } from '../units.ts';

export function calculateEvBatteryDegradation(
  input: EvBatteryDegradationInput
): EvBatteryDegradationResult {
  const { initialCapacityKwh, annualDegradationRatePercent, years } = input;

  if (initialCapacityKwh <= 0 || years <= 0) {
    return {
      projectedCapacityKwh: 0,
      retentionPercent: 100,
      totalLostCapacityKwh: 0,
      yearlyBreakdown: [],
    };
  }

  const validDegradationRate = Math.max(0.1, Math.min(20, annualDegradationRatePercent || 1.8));
  const decayFactor = 1 - validDegradationRate / 100;
  const validYears = Math.max(1, Math.min(25, Math.round(years)));

  const yearlyBreakdown: EvBatteryDegradationYearResult[] = [];
  let currentCapacity = initialCapacityKwh;

  for (let y = 1; y <= validYears; y++) {
    currentCapacity *= decayFactor;
    const retention = (currentCapacity / initialCapacityKwh) * 100;
    const lost = initialCapacityKwh - currentCapacity;

    yearlyBreakdown.push({
      year: y,
      remainingCapacityKwh: roundTo(currentCapacity, 2),
      retentionPercent: roundTo(retention, 1),
      lostCapacityKwh: roundTo(lost, 2),
    });
  }

  const finalYear = yearlyBreakdown[yearlyBreakdown.length - 1];

  return {
    projectedCapacityKwh: finalYear.remainingCapacityKwh,
    retentionPercent: finalYear.retentionPercent,
    totalLostCapacityKwh: finalYear.lostCapacityKwh,
    yearlyBreakdown,
  };
}
