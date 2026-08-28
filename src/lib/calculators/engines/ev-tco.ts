/**
 * 11. EV Total Cost of Ownership (TCO) Calculation Engine
 * Transparent, multi-year vehicle financial model.
 * Net TCO = Acquisition + Energy + Maintenance + Insurance + Taxes + Financing - Resale Value
 */

import type { EvTcoInput, EvTcoResult } from '../types.ts';
import { roundTo } from '../units.ts';

export function calculateEvTco(input: EvTcoInput): EvTcoResult {
  const {
    vehiclePurchasePrice,
    annualDistanceKm,
    ownershipYears,
    evEfficiencyKmPerKwh,
    electricityRate,
    annualInsurance,
    annualMaintenance,
    registrationAndTaxes,
    expectedResaleValuePercent,
    totalFinancingInterest = 0,
  } = input;

  if (vehiclePurchasePrice <= 0 || ownershipYears <= 0 || annualDistanceKm < 0) {
    return {
      totalPurchaseCost: 0,
      totalEnergyCost: 0,
      totalMaintenanceCost: 0,
      totalInsuranceCost: 0,
      totalTaxesAndFees: 0,
      totalFinancingCost: 0,
      estimatedResaleValue: 0,
      netOwnershipCost: 0,
      costPerYear: 0,
      costPerMonth: 0,
      costPerKm: 0,
    };
  }

  const validYears = Math.max(1, Math.min(20, ownershipYears));
  const totalDistanceKm = annualDistanceKm * validYears;

  const energyPerKm = evEfficiencyKmPerKwh > 0 ? 1 / evEfficiencyKmPerKwh : 0;
  const totalEnergyCost = totalDistanceKm * energyPerKm * electricityRate;

  const totalMaintenanceCost = annualMaintenance * validYears;
  const totalInsuranceCost = annualInsurance * validYears;
  const totalTaxesAndFees = registrationAndTaxes;
  const totalFinancingCost = Math.max(0, totalFinancingInterest);

  const totalPurchaseCost = vehiclePurchasePrice + totalTaxesAndFees + totalFinancingCost;
  const validResalePercent = Math.max(0, Math.min(100, expectedResaleValuePercent));
  const estimatedResaleValue = vehiclePurchasePrice * (validResalePercent / 100);

  const grossExpenses = totalPurchaseCost + totalEnergyCost + totalInsuranceCost + totalMaintenanceCost;
  const netOwnershipCost = Math.max(0, grossExpenses - estimatedResaleValue);

  const costPerYear = netOwnershipCost / validYears;
  const costPerMonth = netOwnershipCost / (validYears * 12);
  const costPerKm = totalDistanceKm > 0 ? netOwnershipCost / totalDistanceKm : 0;

  return {
    totalPurchaseCost: roundTo(totalPurchaseCost, 2),
    totalEnergyCost: roundTo(totalEnergyCost, 2),
    totalMaintenanceCost: roundTo(totalMaintenanceCost, 2),
    totalInsuranceCost: roundTo(totalInsuranceCost, 2),
    totalTaxesAndFees: roundTo(totalTaxesAndFees, 2),
    totalFinancingCost: roundTo(totalFinancingCost, 2),
    estimatedResaleValue: roundTo(estimatedResaleValue, 2),
    netOwnershipCost: roundTo(netOwnershipCost, 2),
    costPerYear: roundTo(costPerYear, 2),
    costPerMonth: roundTo(costPerMonth, 2),
    costPerKm: roundTo(costPerKm, 2),
  };
}
