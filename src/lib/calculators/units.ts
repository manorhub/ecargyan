/**
 * ECargyan.com — EV Unit Conversion Utilities
 * Pure, deterministic mathematical functions for energy, distance, speed, and efficiency conversions.
 */

import type { DistanceUnit, EfficiencyUnit } from './types.ts';

export const KM_TO_MILES_FACTOR = 0.621371;
export const MILES_TO_KM_FACTOR = 1.60934;

/**
 * Convert distance between km and miles
 */
export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to || value <= 0) return value;
  if (from === 'km' && to === 'miles') return value * KM_TO_MILES_FACTOR;
  if (from === 'miles' && to === 'km') return value * MILES_TO_KM_FACTOR;
  return value;
}

/**
 * Convert any EV efficiency unit to normalized km/kWh
 */
export function toKmPerKwh(value: number, unit: EfficiencyUnit): number {
  if (value <= 0) return 0;

  switch (unit) {
    case 'km/kWh':
      return value;
    case 'Wh/km':
      // 1000 Wh = 1 kWh => km/kWh = 1000 / (Wh/km)
      return 1000 / value;
    case 'kWh/100km':
      // km/kWh = 100 / (kWh/100km)
      return 100 / value;
    case 'mi/kWh':
      // km/kWh = (mi/kWh) * 1.60934
      return value * MILES_TO_KM_FACTOR;
    default:
      return value;
  }
}

/**
 * Convert normalized km/kWh to any target efficiency unit
 */
export function fromKmPerKwh(kmPerKwh: number, targetUnit: EfficiencyUnit): number {
  if (kmPerKwh <= 0) return 0;

  switch (targetUnit) {
    case 'km/kWh':
      return kmPerKwh;
    case 'Wh/km':
      return 1000 / kmPerKwh;
    case 'kWh/100km':
      return 100 / kmPerKwh;
    case 'mi/kWh':
      return kmPerKwh * KM_TO_MILES_FACTOR;
    default:
      return kmPerKwh;
  }
}

/**
 * Convert decimal hours into a readable string format like "3h 45m" or "45m"
 */
export function formatHoursAndMinutes(decimalHours: number): {
  formatted: string;
  hours: number;
  minutes: number;
} {
  if (decimalHours <= 0 || !isFinite(decimalHours)) {
    return { formatted: '0m', hours: 0, minutes: 0 };
  }

  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return { formatted: `${minutes}m`, hours, minutes };
  }

  if (minutes === 0) {
    return { formatted: `${hours}h`, hours, minutes };
  }

  return { formatted: `${hours}h ${minutes}m`, hours, minutes };
}

/**
 * Round a number safely to fixed decimal places without precision floating point glitches
 */
export function roundTo(value: number, decimals: number = 2): number {
  if (!isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
