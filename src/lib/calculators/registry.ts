/**
 * ECargyan.com — EV Calculator Registry
 * Central metadata, physical formulas, worked examples, and FAQs for all 12 EV calculators.
 */

import type { CalculatorMeta } from './types.ts';

export const CALCULATOR_REGISTRY: Record<string, CalculatorMeta> = {
  'ev-charging-cost-calculator': {
    id: 'ev-charging-cost-calculator',
    slug: 'ev-charging-cost-calculator',
    title: 'EV Charging Cost Calculator',
    shortTitle: 'Charging Cost',
    tagline: 'Calculate precise charging costs including AC/DC efficiency losses and grid power draw.',
    category: 'charging',
    categoryName: 'Charging & Power',
    metaDescription: 'Calculate the exact cost to charge your electric vehicle based on battery capacity, target state of charge (SOC), grid tariff, and charging efficiency losses.',
    primaryResultLabel: 'Estimated Charging Cost',
    formulaDescription: 'Grid electricity draw accounts for AC-to-DC conversion losses (typically 88% to 92% efficiency) before multiplying by the unit electricity tariff.',
    formulaSteps: [
      'Battery Energy Added (kWh) = Battery Capacity (kWh) × ((Target SOC% - Current SOC%) / 100)',
      'Grid Energy Drawn (kWh) = Battery Energy Added (kWh) / (Charging Efficiency% / 100)',
      'Estimated Cost = Grid Energy Drawn (kWh) × Electricity Rate (per kWh)',
    ],
    example: {
      title: 'Mid-Size Electric SUV Home Charge',
      description: 'Charging a 40 kWh battery from 20% to 80% SOC at a home electricity rate of ₹8.00/kWh with 90% onboard charger efficiency.',
      inputs: {
        'Battery Capacity': '40 kWh',
        'Starting SOC': '20%',
        'Target SOC': '80%',
        'Charging Efficiency': '90%',
        'Electricity Tariff': '₹8.00 / kWh',
      },
      expectedOutput: '₹213.33 (26.67 kWh grid energy consumed, 24.00 kWh added to pack)',
      notes: 'Values are calculated deterministically using the physical formula.',
    },
    faqs: [
      {
        question: 'Why does grid energy drawn exceed the battery energy added?',
        answer: 'During EV charging, energy is lost as heat in the onboard AC/DC rectifier, cabling, and battery thermal management system. Modern Level 2 home chargers typically operate at 88% to 93% efficiency.',
      },
      {
        question: 'How do public DC fast charging costs differ from home charging?',
        answer: 'Public DC fast chargers bypass the vehicle’s onboard AC converter to feed high-voltage direct current into the pack, but commercial operators incorporate demand surcharges, operational overheads, and higher tier tariffs.',
      },
      {
        question: 'Does charging speed impact total cost?',
        answer: 'While ultra-fast DC charging incurs higher station service rates, slower AC charging over 8–10 hours during off-peak night hours is substantially more cost-effective.',
      },
    ],
    relatedSlugs: [
      'ev-charging-time-calculator',
      'home-ev-charging-calculator',
      'ev-running-cost-calculator',
      'ev-cost-per-km-calculator',
    ],
    disclaimer: 'Calculated charging costs are estimates based on user-provided tariff rates and steady-state efficiency models. Actual billed utility amounts may reflect tiered slab tariffs, peak demand surcharges, or temperature-dependent preconditioning draw.',
    published: true,
  },

  'ev-running-cost-calculator': {
    id: 'ev-running-cost-calculator',
    slug: 'ev-running-cost-calculator',
    title: 'EV Running Cost Calculator',
    shortTitle: 'Running Cost',
    tagline: 'Compute per-kilometer, monthly, and annual operational electricity expenses.',
    category: 'running-costs',
    categoryName: 'Running Costs',
    metaDescription: 'Determine your electric vehicle running cost per kilometer, per 100 km, monthly, and annually based on driving distance and real-world powertrain efficiency.',
    primaryResultLabel: 'Estimated Running Cost',
    formulaDescription: 'Energy consumption per kilometer is multiplied by your electricity tariff to project running costs across customizable driving periods.',
    formulaSteps: [
      'Energy Consumption (kWh/km) = 1 / Efficiency (km/kWh)',
      'Cost per Kilometer = Energy Consumption (kWh/km) × Electricity Rate',
      'Period Expense = Cost per Kilometer × Commute Distance',
    ],
    example: {
      title: 'Daily Urban Commuter Profile',
      description: 'An electric hatchback delivering 7.5 km/kWh charged at ₹7.50/kWh covering 1,200 km monthly.',
      inputs: {
        'EV Efficiency': '7.5 km/kWh',
        'Electricity Tariff': '₹7.50 / kWh',
        'Monthly Distance': '1,200 km',
      },
      expectedOutput: '₹1.00 / km (₹1,200.00 / month, ₹14,400.00 / year)',
    },
    faqs: [
      {
        question: 'How does driving speed affect EV running costs?',
        answer: 'Aerodynamic drag scales quadratically with speed. Driving at 110 km/h consumes approximately 25% to 35% more energy per kilometer compared to cruising at 70 km/h, directly increasing running costs.',
      },
      {
        question: 'How do climate control systems influence per-km cost?',
        answer: 'Cabin air conditioning and heating draw power directly from the high-voltage traction pack, reducing real-world efficiency by 10% to 20% during extreme weather.',
      },
    ],
    relatedSlugs: [
      'ev-vs-petrol-cost-calculator',
      'ev-cost-per-km-calculator',
      'ev-trip-cost-calculator',
      'ev-savings-calculator',
    ],
    disclaimer: 'Running cost computations rely on steady-state efficiency inputs and static electricity rates. Real-world consumption fluctuates with payload, terrain gradients, ambient temperature, and driving dynamics.',
    published: true,
  },

  'ev-vs-petrol-cost-calculator': {
    id: 'ev-vs-petrol-cost-calculator',
    slug: 'ev-vs-petrol-cost-calculator',
    title: 'EV vs Petrol Cost Calculator',
    shortTitle: 'EV vs Petrol',
    tagline: 'Compare operational expenditure between electric and internal combustion vehicles.',
    category: 'savings',
    categoryName: 'Savings & Comparisons',
    metaDescription: 'Side-by-side cost comparison between electric and petrol vehicles. Calculate per-km fuel savings, monthly expenditure differentials, and annual fuel economy.',
    primaryResultLabel: 'Net Savings with EV',
    formulaDescription: 'Calculates the per-kilometer cost delta between internal combustion fuel consumption and electric powertrain energy draw.',
    formulaSteps: [
      'EV Cost per km = (1 / EV Efficiency km/kWh) × Electricity Rate',
      'Petrol Cost per km = Petrol Price / Petrol Mileage (km/L)',
      'Savings per km = Petrol Cost per km - EV Cost per km',
      'Monthly / Annual Savings = Savings per km × Distance Traveled',
    ],
    example: {
      title: 'Compact Sedan Fuel vs Electric Benchmark',
      description: 'Comparing a petrol car (14 km/L at ₹102/L) against an EV (7.0 km/kWh at ₹8.00/kWh) over 1,500 km per month.',
      inputs: {
        'Petrol Price': '₹102.00 / L',
        'Petrol Mileage': '14.0 km/L',
        'EV Efficiency': '7.0 km/kWh',
        'EV Tariff': '₹8.00 / kWh',
        'Distance': '1,500 km',
      },
      expectedOutput: 'Petrol: ₹7.29/km | EV: ₹1.14/km | Net Savings: ₹6.14/km (₹9,214.29 / month)',
    },
    faqs: [
      {
        question: 'Why are EV running costs so much lower than petrol cars?',
        answer: 'Electric traction motors convert over 85% to 90% of electrical energy into wheel motion, whereas internal combustion engines lose 65% to 75% of fuel energy as waste heat.',
      },
      {
        question: 'Does the comparison factor in regenerative braking?',
        answer: 'Yes, regenerative braking recovery is already built into the overall efficiency metric (km/kWh) of the EV.',
      },
    ],
    relatedSlugs: [
      'ev-savings-calculator',
      'ev-break-even-calculator',
      'ev-total-cost-of-ownership-calculator',
      'ev-running-cost-calculator',
    ],
    disclaimer: 'This comparison focuses on direct energy and fuel operational costs. Routine scheduled maintenance, oil changes, brake wear differentials, and vehicle depreciation are explored in the Total Cost of Ownership tool.',
    published: true,
  },

  'ev-trip-cost-calculator': {
    id: 'ev-trip-cost-calculator',
    slug: 'ev-trip-cost-calculator',
    title: 'EV Trip Cost Calculator',
    shortTitle: 'Trip Cost',
    tagline: 'Estimate total energy requirements and charging expenses for road trips.',
    category: 'running-costs',
    categoryName: 'Running Costs',
    metaDescription: 'Calculate the total energy requirement and electricity cost for highway journeys, intercity road trips, and daily commutes in an electric vehicle.',
    primaryResultLabel: 'Total Trip Electricity Cost',
    formulaDescription: 'Divides trip distance by vehicle efficiency and factors in charging replenishment losses to determine total grid energy cost.',
    formulaSteps: [
      'Battery Energy Required (kWh) = Trip Distance (km) / Efficiency (km/kWh)',
      'Grid Energy Required (kWh) = Battery Energy / (Charging Efficiency% / 100)',
      'Total Trip Cost = Grid Energy Required × Electricity Rate',
    ],
    example: {
      title: 'Intercity Highway Excursion (350 km)',
      description: 'Driving 350 km in an electric crossover achieving 6.2 km/kWh at a public fast charger rate of ₹18.00/kWh.',
      inputs: {
        'Trip Distance': '350 km',
        'Efficiency': '6.2 km/kWh',
        'Charging Rate': '₹18.00 / kWh',
        'Charging Efficiency': '92%',
      },
      expectedOutput: '₹1,104.30 total trip cost (61.35 kWh grid energy drawn, ₹3.16/km)',
    },
    faqs: [
      {
        question: 'How should highway speed be factored into trip planning?',
        answer: 'Highway driving at sustained speeds of 100–120 km/h increases consumption. It is recommended to reduce baseline urban efficiency inputs by 15% to 25% for highway calculations.',
      },
      {
        question: 'Does elevation gain increase trip consumption?',
        answer: 'Climbing mountain passes increases energy draw, though a significant portion is recaptured through regenerative braking on the descent.',
      },
    ],
    relatedSlugs: [
      'ev-running-cost-calculator',
      'ev-range-calculator',
      'ev-charging-cost-calculator',
      'ev-cost-per-km-calculator',
    ],
    disclaimer: 'Trip estimates assume continuous driving with constant efficiency. Wind resistance, payload weight, cabin HVAC usage, and station queuing fees can alter final journey costs.',
    published: true,
  },

  'ev-savings-calculator': {
    id: 'ev-savings-calculator',
    slug: 'ev-savings-calculator',
    title: 'EV Savings Calculator',
    shortTitle: 'EV Savings',
    tagline: 'Calculate cumulative 1-year, 3-year, and 5-year operational savings over petrol.',
    category: 'savings',
    categoryName: 'Savings & Comparisons',
    metaDescription: 'Forecast your cumulative fuel and maintenance savings over 1, 3, and 5 years by transitioning from an internal combustion vehicle to an electric vehicle.',
    primaryResultLabel: 'Estimated Annual Savings',
    formulaDescription: 'Multiplies monthly fuel savings over multi-year horizons and incorporates reduced electric vehicle mechanical maintenance expenses.',
    formulaSteps: [
      'Monthly Fuel Savings = Monthly Petrol Expenditure - Monthly EV Electricity Cost',
      'Annual Savings = (Monthly Fuel Savings × 12) + Annual Maintenance Differential',
      'Multi-Year Savings = Annual Savings × Number of Years',
    ],
    example: {
      title: 'High-Mileage Fleet Commuter',
      description: 'Driving 2,000 km monthly, replacing a 15 km/L petrol car with an electric vehicle delivering 7.0 km/kWh, with ₹12,000 annual maintenance savings.',
      inputs: {
        'Monthly Distance': '2,000 km',
        'Petrol Price': '₹104.00 / L',
        'Petrol Mileage': '15.0 km/L',
        'EV Efficiency': '7.0 km/kWh',
        'EV Rate': '₹8.00 / kWh',
        'Annual Maintenance Saving': '₹12,000',
      },
      expectedOutput: 'Annual Savings: ₹151,085.71 | 3-Year: ₹453,257.14 | 5-Year: ₹755,428.57',
    },
    faqs: [
      {
        question: 'Why do EVs require less annual maintenance?',
        answer: 'Electric vehicles have no engine oil, spark plugs, timing belts, exhaust systems, or multi-speed transmissions. Regenerative braking also significantly extends brake pad lifespan.',
      },
      {
        question: 'How do battery warranty terms protect savings?',
        answer: 'Most manufacturers provide 8-year or 160,000 km battery warranties guaranteeing at least 70% state of health, safeguarding operational savings during the primary ownership cycle.',
      },
    ],
    relatedSlugs: [
      'ev-vs-petrol-cost-calculator',
      'ev-break-even-calculator',
      'ev-total-cost-of-ownership-calculator',
      'ev-running-cost-calculator',
    ],
    disclaimer: 'Projections assume consistent fuel tariffs and driving patterns. Potential future battery replacement or major out-of-warranty repairs are not amortized in routine savings calculations.',
    published: true,
  },

  'ev-charging-time-calculator': {
    id: 'ev-charging-time-calculator',
    slug: 'ev-charging-time-calculator',
    title: 'EV Charging Time Calculator',
    shortTitle: 'Charging Time',
    tagline: 'Estimate replenishment duration across Level 1, Level 2, and DC Fast Chargers.',
    category: 'charging',
    categoryName: 'Charging & Power',
    metaDescription: 'Estimate exact electric vehicle charging duration based on battery pack capacity, state of charge (SOC) delta, charger kilowatt rating, and conversion efficiency.',
    primaryResultLabel: 'Estimated Charging Time',
    formulaDescription: 'Calculates the net energy required to reach target SOC and divides by the effective delivery power of the charging unit.',
    formulaSteps: [
      'Energy Needed (kWh) = Battery Capacity (kWh) × ((Target SOC% - Current SOC%) / 100)',
      'Effective Power (kW) = Charger Power Rating (kW) × (Charging Efficiency% / 100)',
      'Charging Time (hours) = Energy Needed (kWh) / Effective Power (kW)',
    ],
    example: {
      title: '7.4 kW Home AC Wallbox Session',
      description: 'Adding 30 kWh (from 20% to 80% SOC on a 50 kWh pack) using a 7.4 kW Level 2 single-phase AC wallbox at 90% onboard efficiency.',
      inputs: {
        'Battery Capacity': '50 kWh',
        'Current SOC': '20%',
        'Target SOC': '80%',
        'Charger Power': '7.4 kW',
        'Efficiency': '90%',
      },
      expectedOutput: '4h 30m (30.00 kWh energy needed, 6.66 kW effective charging power)',
    },
    faqs: [
      {
        question: 'Why does DC fast charging slow down after 80% SOC?',
        answer: 'Lithium-ion battery cells utilize a constant-current constant-voltage (CCCV) charging profile. As cells reach saturation around 80% SOC, current is tapered to prevent lithium plating, overheating, and premature degradation.',
      },
      {
        question: 'What is the bottleneck: the charger or the vehicle onboard charger (OBC)?',
        answer: 'On AC charging, the vehicle onboard charger limits acceptance power. If a 22 kW AC point is plugged into a car with a 7.2 kW OBC, the vehicle charges at only 7.2 kW.',
      },
    ],
    relatedSlugs: [
      'ev-charging-cost-calculator',
      'home-ev-charging-calculator',
      'ev-range-calculator',
      'ev-battery-degradation-calculator',
    ],
    disclaimer: 'Actual charging times vary due to OEM BMS charging curves, ambient and pack temperatures, station power throttling, and cell balancing routines in the final 10% SOC band.',
    published: true,
  },

  'ev-range-calculator': {
    id: 'ev-range-calculator',
    slug: 'ev-range-calculator',
    title: 'EV Range Calculator',
    shortTitle: 'EV Range',
    tagline: 'Estimate real-world driving range from usable battery capacity and consumption.',
    category: 'range',
    categoryName: 'Range & Performance',
    metaDescription: 'Calculate realistic electric vehicle driving range based on gross battery capacity, usable capacity buffer, and customizable efficiency metrics.',
    primaryResultLabel: 'Estimated Driving Range',
    primaryResultUnit: 'km',
    formulaDescription: 'Multiplies usable traction pack capacity by the vehicle consumption efficiency metric.',
    formulaSteps: [
      'Usable Battery Capacity (kWh) = Gross Capacity (kWh) × (Usable Buffer% / 100)',
      'Estimated Range (km) = Usable Battery Capacity (kWh) × Efficiency (km/kWh)',
      'Estimated Range (miles) = Estimated Range (km) × 0.621371',
    ],
    example: {
      title: '60 kWh Long-Range Crossover',
      description: 'A 60 kWh gross pack (95% net usable buffer) operating at an efficiency of 6.5 km/kWh.',
      inputs: {
        'Gross Battery Capacity': '60 kWh',
        'Usable Buffer': '95%',
        'Vehicle Efficiency': '6.5 km/kWh',
      },
      expectedOutput: '370.5 km (230.2 miles) from 57.00 kWh usable capacity',
    },
    faqs: [
      {
        question: 'What is the difference between gross and net usable battery capacity?',
        answer: 'Gross capacity is the physical total capacity of all cells combined. Net (usable) capacity is the software-accessible portion, with safety buffers reserved at top and bottom to ensure cell longevity.',
      },
      {
        question: 'Why does official WLTP / ARAI range differ from real-world range?',
        answer: 'Standardized test cycles are conducted in controlled lab conditions without headwinds, aggressive acceleration, high-speed aerodynamic drag, or heavy climate control usage.',
      },
    ],
    relatedSlugs: [
      'ev-cost-per-km-calculator',
      'ev-trip-cost-calculator',
      'ev-charging-time-calculator',
      'ev-battery-degradation-calculator',
    ],
    disclaimer: 'Range figures are mathematical projections based on constant efficiency inputs. Real driving range depends on driving aggressiveness, tire pressure, payload weight, ambient temperature, and terrain elevation.',
    published: true,
  },

  'ev-cost-per-km-calculator': {
    id: 'ev-cost-per-km-calculator',
    slug: 'ev-cost-per-km-calculator',
    title: 'EV Cost Per Km Calculator',
    shortTitle: 'Cost Per Km',
    tagline: 'Calculate exact unit electricity expense per kilometer and per 100 km.',
    category: 'running-costs',
    categoryName: 'Running Costs',
    metaDescription: 'Calculate the exact unit cost to drive an electric car per kilometer and per 100 km using energy consumption metrics in km/kWh, Wh/km, or kWh/100km.',
    primaryResultLabel: 'Cost Per Kilometer',
    formulaDescription: 'Converts efficiency into energy consumed per kilometer and multiplies by the local electricity tariff.',
    formulaSteps: [
      'Energy per km (kWh) = 1 / Efficiency (km/kWh)',
      'Cost per km = Energy per km (kWh) × Electricity Rate',
      'Cost per 100 km = Cost per km × 100',
    ],
    example: {
      title: 'City Electric Hatchback',
      description: 'An EV with an efficiency of 140 Wh/km (7.14 km/kWh) charged at a domestic tariff of ₹7.00/kWh.',
      inputs: {
        'Energy Consumption': '140 Wh/km',
        'Electricity Tariff': '₹7.00 / kWh',
      },
      expectedOutput: '₹0.98 / km (₹98.00 per 100 km)',
    },
    faqs: [
      {
        question: 'How do I convert Wh/km to km/kWh?',
        answer: 'Divide 1,000 by the Wh/km figure. For example, 1000 ÷ 125 Wh/km = 8.0 km/kWh.',
      },
      {
        question: 'What is considered good EV efficiency?',
        answer: 'Modern electric passenger cars typically achieve between 6.0 and 8.5 km/kWh (120–165 Wh/km) in urban driving.',
      },
    ],
    relatedSlugs: [
      'ev-running-cost-calculator',
      'ev-vs-petrol-cost-calculator',
      'ev-trip-cost-calculator',
      'ev-range-calculator',
    ],
    disclaimer: 'Calculated unit costs exclude fixed utility meter connection charges and auxiliary charging hardware amortization.',
    published: true,
  },

  'home-ev-charging-calculator': {
    id: 'home-ev-charging-calculator',
    slug: 'home-ev-charging-calculator',
    title: 'Home EV Charging Calculator',
    shortTitle: 'Home Charging',
    tagline: 'Calculate domestic overnight charging expenses, grid draw, and session time.',
    category: 'charging',
    categoryName: 'Charging & Power',
    metaDescription: 'Calculate home electricity bills and session durations for overnight Level 1 (3.3 kW) and Level 2 (7.4 kW / 11 kW) residential EV chargers.',
    primaryResultLabel: 'Home Charging Session Cost',
    formulaDescription: 'Separates battery energy added from grid electricity drawn through domestic AC wallboxes, factoring in onboard charger efficiency.',
    formulaSteps: [
      'Battery Energy Added (kWh) = Pack Capacity × ((Target SOC - Current SOC) / 100)',
      'Grid Energy Consumed (kWh) = Battery Energy Added / (Charging Efficiency / 100)',
      'Total Home Cost = Grid Energy Consumed × Domestic Tariff Rate',
      'Session Time = Battery Energy Added / (Charger Power × Efficiency)',
    ],
    example: {
      title: 'Overnight 3.3 kW AC 16A Plug Session',
      description: 'Charging 25 kWh into a battery pack from 30% to 90% SOC on a 3.3 kW portable domestic socket at ₹6.50/kWh with 88% efficiency.',
      inputs: {
        'Battery Capacity': '42 kWh',
        'Current SOC': '30%',
        'Target SOC': '90%',
        'Charger Power': '3.3 kW',
        'Domestic Tariff': '₹6.50 / kWh',
        'Efficiency': '88%',
      },
      expectedOutput: '₹185.94 total session cost (28.64 kWh grid energy, approx. 8h 40m session time)',
    },
    faqs: [
      {
        question: 'Can I charge an EV safely using a standard 16A domestic wall socket?',
        answer: 'Yes, Level 1 charging at 2.3 kW to 3.3 kW is safe when using a dedicated industrial 16A circuit with proper earthing (grounding) and an MCB rated for continuous load.',
      },
      {
        question: 'Is installing a 7.4 kW home wallbox worth the upgrade?',
        answer: 'A dedicated 7.4 kW Level 2 wallbox reduces charging time by more than half compared to a 3.3 kW socket and incorporates built-in dynamic load balancing and safety isolation.',
      },
    ],
    relatedSlugs: [
      'ev-charging-cost-calculator',
      'ev-charging-time-calculator',
      'ev-running-cost-calculator',
      'ev-cost-per-km-calculator',
    ],
    disclaimer: 'Home charging costs assume a constant flat tariff. Time-of-Day (ToD) tariffs or progressive slab utility billing may affect final monthly electricity bills.',
    published: true,
  },

  'ev-battery-degradation-calculator': {
    id: 'ev-battery-degradation-calculator',
    slug: 'ev-battery-degradation-calculator',
    title: 'EV Battery Degradation Calculator',
    shortTitle: 'Battery Health',
    tagline: 'Project multi-year battery capacity retention and State of Health (SOH).',
    category: 'ownership',
    categoryName: 'Ownership & Economics',
    metaDescription: 'Model long-term lithium-ion traction battery degradation, remaining kilowatt-hour capacity, and State of Health (SOH) retention over 1 to 15 years.',
    primaryResultLabel: 'Projected Battery Capacity',
    primaryResultUnit: 'kWh',
    formulaDescription: 'Applies empirical compound annual degradation decay rates across cumulative operating years to project remaining storage capacity.',
    formulaSteps: [
      'Retention Ratio = (1 - (Annual Degradation Rate% / 100))^Years',
      'Projected Capacity (kWh) = Initial Capacity (kWh) × Retention Ratio',
      'Lost Capacity (kWh) = Initial Capacity (kWh) - Projected Capacity (kWh)',
    ],
    example: {
      title: '8-Year Battery Lifespan Projection',
      description: 'A 50 kWh lithium iron phosphate (LFP) pack with an empirical 1.8% annual degradation rate over an 8-year ownership cycle.',
      inputs: {
        'Initial Capacity': '50 kWh',
        'Annual Degradation Rate': '1.8%',
        'Ownership Period': '8 Years',
      },
      expectedOutput: '43.23 kWh remaining capacity (86.5% SOH retention, 6.77 kWh lost capacity)',
    },
    faqs: [
      {
        question: 'What is the average annual degradation rate of modern EV batteries?',
        answer: 'Real-world fleet data from modern liquid-cooled lithium-ion packs indicates an average degradation rate of 1.5% to 2.2% annually, with the steepest degradation occurring in Year 1.',
      },
      {
        question: 'How does cell chemistry (LFP vs NMC) impact degradation?',
        answer: 'Lithium Iron Phosphate (LFP) cells typically tolerate higher thermal thresholds and full 100% charging cycles with lower degradation compared to high-energy-density Nickel Manganese Cobalt (NMC) chemistries.',
      },
      {
        question: 'What best practices maximize battery health?',
        answer: 'Keeping daily charging between 20% and 80% SOC, minimizing frequent ultra-fast DC charging in high ambient temperatures, and avoiding leaving the pack sitting at 100% charge for extended periods.',
      },
    ],
    relatedSlugs: [
      'ev-range-calculator',
      'ev-total-cost-of-ownership-calculator',
      'ev-charging-time-calculator',
      'ev-charging-cost-calculator',
    ],
    disclaimer: 'This model is an empirical mathematical projection. Actual degradation depends on cell chemistry, thermal management efficacy, fast charging frequency, depth of discharge, and environmental heat exposure.',
    published: true,
  },

  'ev-total-cost-of-ownership-calculator': {
    id: 'ev-total-cost-of-ownership-calculator',
    slug: 'ev-total-cost-of-ownership-calculator',
    title: 'EV Total Cost of Ownership Calculator',
    shortTitle: 'TCO Calculator',
    tagline: 'Comprehensive multi-year lifecycle financial analysis for electric vehicles.',
    category: 'ownership',
    categoryName: 'Ownership & Economics',
    metaDescription: 'Analyze the complete lifecycle cost of owning an electric car, including purchase price, financing, energy expenditure, insurance, maintenance, and projected resale value.',
    primaryResultLabel: 'Net Total Cost of Ownership',
    formulaDescription: 'Sums all vehicle acquisition, financing, operational electricity, maintenance, insurance, and tax expenses, then subtracts the projected residual resale value.',
    formulaSteps: [
      'Gross Expenditure = Purchase Price + Taxes + Financing + Energy + Maintenance + Insurance',
      'Estimated Resale Value = Purchase Price × (Expected Resale% / 100)',
      'Net TCO = Gross Expenditure - Estimated Resale Value',
      'Cost per km = Net TCO / Total Lifetime Distance (km)',
    ],
    example: {
      title: '5-Year Ownership Financial Audit',
      description: 'A ₹1,800,000 electric SUV driven 15,000 km annually over 5 years (75,000 km total) with 45% residual value.',
      inputs: {
        'Purchase Price': '₹1,800,000',
        'Annual Distance': '15,000 km',
        'Ownership Period': '5 Years',
        'EV Efficiency': '6.8 km/kWh',
        'Electricity Rate': '₹8.00 / kWh',
        'Annual Insurance': '₹35,000',
        'Annual Maintenance': '₹10,000',
        'Taxes / Registration': '₹80,000',
        'Expected Resale': '45%',
      },
      expectedOutput: 'Net TCO: ₹1,368,235.29 (₹273,647.06/year, ₹18.24/km inclusive of depreciation)',
    },
    faqs: [
      {
        question: 'Why is TCO a better metric than upfront sticker price?',
        answer: 'While electric vehicles may carry higher initial sticker prices, lower fuel costs, reduced maintenance requirements, and tax incentives often result in lower total cost over 3–5 years.',
      },
      {
        question: 'How do residual resale values affect TCO?',
        answer: 'Depreciation is the largest single component of vehicle ownership cost. High battery retention and transferable warranties bolster secondhand EV residual values.',
      },
    ],
    relatedSlugs: [
      'ev-break-even-calculator',
      'ev-savings-calculator',
      'ev-vs-petrol-cost-calculator',
      'ev-battery-degradation-calculator',
    ],
    disclaimer: 'TCO calculations are financial estimates based on user assumptions. Unforeseen insurance premium adjustments, interest rate variations, or macroeconomic secondhand market shifts may alter actual net ownership expenses.',
    published: true,
  },

  'ev-break-even-calculator': {
    id: 'ev-break-even-calculator',
    slug: 'ev-break-even-calculator',
    title: 'EV Break-Even Calculator',
    shortTitle: 'Break-Even',
    tagline: 'Calculate the exact distance and timeframe required to recover the EV purchase premium.',
    category: 'savings',
    categoryName: 'Savings & Comparisons',
    metaDescription: 'Find out how many kilometers and years of driving are required to recover the upfront price premium of an electric vehicle through operational fuel savings.',
    primaryResultLabel: 'Break-Even Milestone',
    primaryResultUnit: 'km',
    formulaDescription: 'Divides the initial purchase price premium by the per-kilometer operational cost savings to determine the financial recovery point.',
    formulaSteps: [
      'Purchase Premium = EV Purchase Price - Petrol Purchase Price',
      'Operational Savings per km = Petrol Cost per km - EV Cost per km',
      'Break-Even Distance (km) = Purchase Premium / Operational Savings per km',
      'Break-Even Time (Years) = Break-Even Distance (km) / Annual Driving Distance (km)',
    ],
    example: {
      title: '₹300,000 Upfront EV Premium Recovery',
      description: 'Comparing a ₹1,500,000 EV against a ₹1,200,000 petrol car with a ₹5.50/km operational savings advantage at 15,000 km annual commute.',
      inputs: {
        'EV Price': '₹1,500,000',
        'Petrol Price': '₹1,200,000',
        'EV Cost/km': '₹1.20 / km',
        'Petrol Cost/km': '₹6.70 / km',
        'Annual Distance': '15,000 km',
      },
      expectedOutput: '54,545 km break-even distance (approx. 3.6 years / 43.6 months)',
    },
    faqs: [
      {
        question: 'What happens if the EV is priced lower or equal to the petrol car?',
        answer: 'If government subsidies, state tax waivers, or segment pricing make the EV cheaper upfront, the break-even is immediate (Day 1), delivering pure savings from the first kilometer.',
      },
      {
        question: 'Does higher annual mileage speed up break-even?',
        answer: 'Yes, because operational savings accumulate on every kilometer driven, commercial fleets and high-mileage commuters recover the purchase premium significantly faster.',
      },
    ],
    relatedSlugs: [
      'ev-vs-petrol-cost-calculator',
      'ev-savings-calculator',
      'ev-total-cost-of-ownership-calculator',
      'ev-running-cost-calculator',
    ],
    disclaimer: 'The break-even model focuses on purchase price and direct per-kilometer energy cost differentials. Financing interest rate variations, registration concessions, and maintenance schedule differences can influence the actual financial break-even point.',
    published: true,
  },
};

export const CALCULATOR_CATEGORIES = [
  {
    id: 'charging',
    name: 'Charging & Power',
    description: 'Calculate charging costs, session duration, power losses, and domestic wallbox requirements.',
  },
  {
    id: 'running-costs',
    name: 'Running Costs',
    description: 'Analyze per-kilometer, trip, monthly, and annual operational electricity expenses.',
  },
  {
    id: 'savings',
    name: 'Savings & Comparisons',
    description: 'Benchmark EV efficiency against petrol vehicles, multi-year savings, and purchase break-even.',
  },
  {
    id: 'range',
    name: 'Range & Performance',
    description: 'Model real-world driving range based on usable battery capacity buffers and vehicle efficiency.',
  },
  {
    id: 'ownership',
    name: 'Ownership & Economics',
    description: 'Evaluate multi-year total cost of ownership (TCO) and long-term battery degradation health.',
  },
];
