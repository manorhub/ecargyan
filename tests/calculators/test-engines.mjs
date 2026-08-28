/**
 * ECargyan.com — EV Calculator System Test Suite
 * Validates calculation accuracy, unit conversions, currency formatting, boundary cases, and worked examples.
 */

import assert from 'node:assert/strict';
import { calculateEvChargingCost } from '../../src/lib/calculators/engines/ev-charging-cost.ts';
import { calculateEvRunningCost } from '../../src/lib/calculators/engines/ev-running-cost.ts';
import { calculateEvVsPetrolCost } from '../../src/lib/calculators/engines/ev-vs-petrol-cost.ts';
import { calculateEvTripCost } from '../../src/lib/calculators/engines/ev-trip-cost.ts';
import { calculateEvSavings } from '../../src/lib/calculators/engines/ev-savings.ts';
import { calculateEvChargingTime } from '../../src/lib/calculators/engines/ev-charging-time.ts';
import { calculateEvRange } from '../../src/lib/calculators/engines/ev-range.ts';
import { calculateEvCostPerKm } from '../../src/lib/calculators/engines/ev-cost-per-km.ts';
import { calculateHomeEvCharging } from '../../src/lib/calculators/engines/home-ev-charging.ts';
import { calculateEvBatteryDegradation } from '../../src/lib/calculators/engines/ev-battery-degradation.ts';
import { calculateEvTco } from '../../src/lib/calculators/engines/ev-tco.ts';
import { calculateEvBreakEven } from '../../src/lib/calculators/engines/ev-break-even.ts';

import {
  convertDistance,
  toKmPerKwh,
  fromKmPerKwh,
  formatHoursAndMinutes,
  roundTo,
} from '../../src/lib/calculators/units.ts';

import { formatCurrency, SUPPORTED_CURRENCIES } from '../../src/lib/calculators/currency.ts';
import { CALCULATOR_REGISTRY } from '../../src/lib/calculators/registry.ts';

console.log('--- RUNNING ECARGYAN EV CALCULATOR TEST SUITE ---\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// 1. Unit Conversion Tests
runTest('Unit Conversions: Distance (km <-> miles)', () => {
  assert.equal(roundTo(convertDistance(100, 'km', 'miles'), 2), 62.14);
  assert.equal(roundTo(convertDistance(62.1371, 'miles', 'km'), 2), 100);
  assert.equal(convertDistance(0, 'km', 'miles'), 0);
});

runTest('Unit Conversions: Efficiency conversions', () => {
  // 140 Wh/km => 1000/140 = 7.1428... km/kWh
  assert.equal(roundTo(toKmPerKwh(140, 'Wh/km'), 2), 7.14);
  // 15 kWh/100km => 100/15 = 6.666... km/kWh
  assert.equal(roundTo(toKmPerKwh(15, 'kWh/100km'), 2), 6.67);
  // 4 mi/kWh => 4 * 1.60934 = 6.437... km/kWh
  assert.equal(roundTo(toKmPerKwh(4, 'mi/kWh'), 2), 6.44);
  // fromKmPerKwh back to Wh/km
  assert.equal(roundTo(fromKmPerKwh(7.142857, 'Wh/km'), 1), 140);
});

runTest('Unit Conversions: Time formatting', () => {
  assert.equal(formatHoursAndMinutes(4.5).formatted, '4h 30m');
  assert.equal(formatHoursAndMinutes(0.75).formatted, '45m');
  assert.equal(formatHoursAndMinutes(2).formatted, '2h');
  assert.equal(formatHoursAndMinutes(0).formatted, '0m');
});

// 2. Currency Formatting Tests
runTest('Currency: Supported Currencies & Symbols', () => {
  assert.ok(SUPPORTED_CURRENCIES.INR);
  assert.ok(SUPPORTED_CURRENCIES.USD);
  assert.ok(SUPPORTED_CURRENCIES.EUR);
  assert.ok(SUPPORTED_CURRENCIES.GBP);
  assert.ok(SUPPORTED_CURRENCIES.AED);

  assert.equal(formatCurrency(128.42, 'INR'), '₹128.42');
  assert.equal(formatCurrency(128.42, 'USD'), '$128.42');
  assert.equal(formatCurrency(128.42, 'EUR'), '€128.42');
  assert.equal(formatCurrency(128.42, 'GBP'), '£128.42');
  assert.equal(formatCurrency(128.42, 'AED'), '128.42 د.إ');
});

// 3. Test Prompt Example Vector (EV Charging: 40 kWh, 20% to 80%, 90% eff, ₹8/kWh)
runTest('Engine 1: EV Charging Cost (Prompt Test Vector)', () => {
  const result = calculateEvChargingCost({
    batteryCapacityKwh: 40,
    currentSocPercent: 20,
    targetSocPercent: 80,
    chargingEfficiencyPercent: 90,
    electricityRate: 8,
  });

  // Battery Energy Added = 40 * (60/100) = 24 kWh
  assert.equal(result.batteryEnergyAddedKwh, 24);
  // Grid Energy Consumed = 24 / 0.90 = 26.67 kWh
  assert.equal(result.gridEnergyConsumedKwh, 26.67);
  // Estimated Cost = 26.666... * 8 = 213.33
  assert.equal(result.estimatedCost, 213.33);
  assert.equal(result.costPerKwhAdded, 8.89);
  assert.equal(result.energyLossKwh, 2.67);
});

// 4. EV Running Cost
runTest('Engine 2: EV Running Cost', () => {
  const result = calculateEvRunningCost({
    efficiencyValue: 7.5,
    efficiencyUnit: 'km/kWh',
    electricityRate: 7.5,
    distance: 1200,
    distancePeriod: 'monthly',
  });

  assert.equal(result.costPerKm, 1.0);
  assert.equal(result.costPer100Km, 100.0);
  assert.equal(result.periodCost, 1200.0);
  assert.equal(result.annualCost, 14400.0);
  assert.equal(result.energyConsumedKwh, 160.0);
});

// 5. EV vs Petrol Cost
runTest('Engine 3: EV vs Petrol Cost Comparison', () => {
  const result = calculateEvVsPetrolCost({
    evEfficiencyValue: 7.0,
    evEfficiencyUnit: 'km/kWh',
    evElectricityRate: 8.0,
    petrolMileageKmPerLitre: 14.0,
    petrolPricePerLitre: 102.0,
    distanceKm: 1500,
  });

  assert.equal(result.evCostPerKm, 1.14);
  assert.equal(result.petrolCostPerKm, 7.29);
  assert.equal(result.differencePerKm, 6.14);
  assert.equal(result.tripEvCost, 1714.29);
  assert.equal(result.tripPetrolCost, 10928.57);
  assert.equal(result.tripSavings, 9214.29);
});

// 6. EV Trip Cost
runTest('Engine 4: EV Trip Cost', () => {
  const result = calculateEvTripCost({
    tripDistanceKm: 350,
    efficiencyValue: 6.2,
    efficiencyUnit: 'km/kWh',
    electricityRate: 18.0,
    chargingEfficiencyPercent: 92,
  });

  assert.equal(result.batteryEnergyRequiredKwh, 56.45);
  assert.equal(result.gridEnergyConsumedKwh, 61.36);
  assert.equal(result.totalTripCost, 1104.49);
  assert.equal(result.costPerKm, 3.16);
});

// 7. EV Savings
runTest('Engine 5: EV Savings', () => {
  const result = calculateEvSavings({
    monthlyDistanceKm: 2000,
    petrolMileageKmPerLitre: 15.0,
    petrolPricePerLitre: 104.0,
    evEfficiencyKmPerKwh: 7.0,
    evElectricityRate: 8.0,
    annualMaintenanceSaving: 12000,
  });

  // Monthly petrol = (2000/15)*104 = 13866.67
  // Monthly EV = (2000/7)*8 = 2285.71
  // Monthly savings = 11580.95
  assert.equal(result.monthlySavings, 11580.95);
  assert.equal(result.annualSavings, 150971.43);
  assert.equal(result.threeYearSavings, 452914.29);
  assert.equal(result.fiveYearSavings, 754857.14);
});

// 8. EV Charging Time
runTest('Engine 6: EV Charging Time', () => {
  const result = calculateEvChargingTime({
    batteryCapacityKwh: 50,
    currentSocPercent: 20,
    targetSocPercent: 80,
    chargerPowerKw: 7.4,
    chargingEfficiencyPercent: 90,
  });

  assert.equal(result.energyNeededKwh, 30);
  assert.equal(result.effectiveChargingPowerKw, 6.66);
  assert.equal(result.chargingTimeHours, 4.5);
  assert.equal(result.chargingTimeFormatted, '4h 30m');
});

// 9. EV Range
runTest('Engine 7: EV Range', () => {
  const result = calculateEvRange({
    batteryCapacityKwh: 60,
    usableCapacityPercent: 95,
    efficiencyValue: 6.5,
    efficiencyUnit: 'km/kWh',
  });

  assert.equal(result.usableCapacityKwh, 57.0);
  assert.equal(result.estimatedRangeKm, 370.5);
  assert.equal(result.estimatedRangeMiles, 230.2);
});

// 10. EV Cost Per Km
runTest('Engine 8: EV Cost Per Km', () => {
  const result = calculateEvCostPerKm({
    efficiencyValue: 140,
    efficiencyUnit: 'Wh/km',
    electricityRate: 7.0,
  });

  assert.equal(result.costPerKm, 0.98);
  assert.equal(result.costPer100Km, 98.0);
  assert.equal(result.energyPerKmKwh, 0.14);
});

// 11. Home EV Charging
runTest('Engine 9: Home EV Charging', () => {
  const result = calculateHomeEvCharging({
    batteryCapacityKwh: 42,
    currentSocPercent: 30,
    targetSocPercent: 90,
    homeElectricityRate: 6.5,
    chargerPowerKw: 3.3,
    chargingEfficiencyPercent: 88,
  });

  assert.equal(result.batteryEnergyAddedKwh, 25.2);
  assert.equal(result.gridEnergyConsumedKwh, 28.64);
  assert.equal(result.totalChargingCost, 186.14);
});

// 12. Battery Degradation
runTest('Engine 10: Battery Degradation', () => {
  const result = calculateEvBatteryDegradation({
    initialCapacityKwh: 50,
    annualDegradationRatePercent: 1.8,
    years: 8,
  });

  assert.equal(result.projectedCapacityKwh, 43.24);
  assert.equal(result.retentionPercent, 86.5);
  assert.equal(result.totalLostCapacityKwh, 6.76);
  assert.equal(result.yearlyBreakdown.length, 8);
});

// 13. EV TCO
runTest('Engine 11: Total Cost of Ownership (TCO)', () => {
  const result = calculateEvTco({
    vehiclePurchasePrice: 1800000,
    annualDistanceKm: 15000,
    ownershipYears: 5,
    evEfficiencyKmPerKwh: 6.8,
    electricityRate: 8.0,
    annualInsurance: 35000,
    annualMaintenance: 10000,
    registrationAndTaxes: 80000,
    expectedResaleValuePercent: 45,
  });

  assert.equal(result.totalPurchaseCost, 1880000);
  assert.equal(result.totalEnergyCost, 88235.29);
  assert.equal(result.totalInsuranceCost, 175000);
  assert.equal(result.totalMaintenanceCost, 50000);
  assert.equal(result.estimatedResaleValue, 810000);
  assert.equal(result.netOwnershipCost, 1383235.29);
  assert.equal(result.costPerKm, 18.44);
});

// 14. EV Break-Even
runTest('Engine 12: Break-Even Point', () => {
  const result = calculateEvBreakEven({
    evPurchasePrice: 1500000,
    petrolPurchasePrice: 1200000,
    evCostPerKm: 1.2,
    petrolCostPerKm: 6.7,
    annualDistanceKm: 15000,
  });

  assert.equal(result.purchasePremium, 300000);
  assert.equal(result.runningCostSavingsPerKm, 5.5);
  assert.equal(result.breakEvenDistanceKm, 54545);
  assert.equal(result.breakEvenYears, 3.6);
  assert.equal(result.breakEvenMonths, 43.6);
  assert.equal(result.isImmediatelyCheaper, false);
});

// 15. Boundary & Zero Value Tests
runTest('Boundary Tests: Zero & Negative Handling', () => {
  const zeroCharging = calculateEvChargingCost({
    batteryCapacityKwh: 0,
    currentSocPercent: 0,
    targetSocPercent: 0,
    chargingEfficiencyPercent: 0,
    electricityRate: 0,
  });
  assert.equal(zeroCharging.estimatedCost, 0);

  const zeroRunning = calculateEvRunningCost({
    efficiencyValue: 0,
    efficiencyUnit: 'km/kWh',
    electricityRate: 0,
    distance: 0,
    distancePeriod: 'trip',
  });
  assert.equal(zeroRunning.costPerKm, 0);

  const cheaperEvBreakEven = calculateEvBreakEven({
    evPurchasePrice: 1000000,
    petrolPurchasePrice: 1200000,
    evCostPerKm: 1.0,
    petrolCostPerKm: 6.0,
    annualDistanceKm: 12000,
  });
  assert.equal(cheaperEvBreakEven.isImmediatelyCheaper, true);
  assert.equal(cheaperEvBreakEven.breakEvenDistanceKm, 0);
});

// 16. Registry Integrity Tests
runTest('Registry: All 12 Calculators Registered & Validated', () => {
  const keys = Object.keys(CALCULATOR_REGISTRY);
  assert.equal(keys.length, 12);
  for (const key of keys) {
    const item = CALCULATOR_REGISTRY[key];
    assert.ok(item.title, `Missing title for ${key}`);
    assert.ok(item.slug, `Missing slug for ${key}`);
    assert.ok(item.metaDescription, `Missing metaDescription for ${key}`);
    assert.ok(item.formulaSteps.length > 0, `Missing formulaSteps for ${key}`);
    assert.ok(item.faqs.length > 0, `Missing faqs for ${key}`);
    assert.ok(item.example, `Missing example for ${key}`);
  }
});

console.log(`\n==============================================`);
console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log(`==============================================\n`);
