/**
 * 12. EV Break-Even Calculation Engine
 * Formula:
 * Purchase Premium = EV Price - Petrol Price
 * Operational Savings/km = Petrol Cost/km - EV Cost/km
 * Break-Even Distance = Purchase Premium / Operational Savings/km
 * Break-Even Time (Years) = Break-Even Distance / Annual Distance
 */

import type { EvBreakEvenInput, EvBreakEvenResult } from '../types.ts';
import { roundTo } from '../units.ts';

export function calculateEvBreakEven(input: EvBreakEvenInput): EvBreakEvenResult {
  const {
    evPurchasePrice,
    petrolPurchasePrice,
    evCostPerKm,
    petrolCostPerKm,
    annualDistanceKm,
  } = input;

  if (evPurchasePrice < 0 || petrolPurchasePrice < 0 || annualDistanceKm <= 0) {
    return {
      purchasePremium: 0,
      runningCostSavingsPerKm: 0,
      breakEvenDistanceKm: 0,
      breakEvenYears: 0,
      breakEvenMonths: 0,
      isImmediatelyCheaper: false,
    };
  }

  const purchasePremium = evPurchasePrice - petrolPurchasePrice;
  const runningCostSavingsPerKm = petrolCostPerKm - evCostPerKm;

  if (purchasePremium <= 0) {
    return {
      purchasePremium: roundTo(purchasePremium, 2),
      runningCostSavingsPerKm: roundTo(runningCostSavingsPerKm, 2),
      breakEvenDistanceKm: 0,
      breakEvenYears: 0,
      breakEvenMonths: 0,
      isImmediatelyCheaper: true,
    };
  }

  if (runningCostSavingsPerKm <= 0) {
    return {
      purchasePremium: roundTo(purchasePremium, 2),
      runningCostSavingsPerKm: roundTo(runningCostSavingsPerKm, 2),
      breakEvenDistanceKm: 0,
      breakEvenYears: 0,
      breakEvenMonths: 0,
      isImmediatelyCheaper: false,
    };
  }

  const breakEvenDistanceKm = purchasePremium / runningCostSavingsPerKm;
  const breakEvenYears = breakEvenDistanceKm / annualDistanceKm;
  const breakEvenMonths = breakEvenYears * 12;

  return {
    purchasePremium: roundTo(purchasePremium, 2),
    runningCostSavingsPerKm: roundTo(runningCostSavingsPerKm, 2),
    breakEvenDistanceKm: roundTo(breakEvenDistanceKm, 0),
    breakEvenYears: roundTo(breakEvenYears, 1),
    breakEvenMonths: roundTo(breakEvenMonths, 1),
    isImmediatelyCheaper: false,
  };
}
