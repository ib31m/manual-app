import type { FuelGradeDef, SulphurCategory } from '../domain/types';

// Fossil fuel grades — transcribed from s-Insight manual §3.10.1 (Recorder 2.12.0).
export const FOSSIL_GRADES: FuelGradeDef[] = [
  { id: 'RMA10', fuelClass: 'Fossil', category: 'LFO', type: 'RMA10' },
  { id: 'RMA20', fuelClass: 'Fossil', category: 'LFO', type: 'RMA20' },
  { id: 'RMB30', fuelClass: 'Fossil', category: 'LFO', type: 'RMB30' },
  { id: 'RMD80', fuelClass: 'Fossil', category: 'LFO', type: 'RMD80' },
  { id: 'RME180', fuelClass: 'Fossil', category: 'HFO', type: 'RME180' },
  { id: 'RMG180', fuelClass: 'Fossil', category: 'HFO', type: 'RMG180' },
  { id: 'RMG380', fuelClass: 'Fossil', category: 'HFO', type: 'RMG380' },
  { id: 'RMG500', fuelClass: 'Fossil', category: 'HFO', type: 'RMG500' },
  { id: 'RMG700', fuelClass: 'Fossil', category: 'HFO', type: 'RMG700' },
  { id: 'RMK380', fuelClass: 'Fossil', category: 'HFO', type: 'RMK380' },
  { id: 'RMK500', fuelClass: 'Fossil', category: 'HFO', type: 'RMK500' },
  { id: 'RMK700', fuelClass: 'Fossil', category: 'HFO', type: 'RMK700' },
  { id: 'DMX', fuelClass: 'Fossil', category: 'MDO/MGO', type: 'DMX' },
  { id: 'DMZ', fuelClass: 'Fossil', category: 'MDO/MGO', type: 'DMZ' },
  { id: 'DMB', fuelClass: 'Fossil', category: 'MDO/MGO', type: 'DMB' },
  { id: 'DMA', fuelClass: 'Fossil', category: 'MDO/MGO', type: 'DMA' },
  { id: 'DMC', fuelClass: 'Fossil', category: 'MDO/MGO', type: 'DMC' },
  { id: 'LNG', fuelClass: 'Fossil', category: 'Gaseous', type: 'LNG' },
  { id: 'ETHANE', fuelClass: 'Fossil', category: 'Gaseous', type: 'Ethane' },
  { id: 'LPG_P', fuelClass: 'Fossil', category: 'Gaseous', type: 'LPG (Propane)' },
  { id: 'LPG_B', fuelClass: 'Fossil', category: 'Gaseous', type: 'LPG (Butane)' },
  { id: 'H2', fuelClass: 'Fossil', category: 'Gaseous', type: 'Hydrogen' },
  { id: 'NH3', fuelClass: 'Fossil', category: 'Gaseous', type: 'Ammonia' },
  { id: 'ETHANOL', fuelClass: 'Fossil', category: 'Alcohol', type: 'Ethanol' },
  { id: 'METHANOL', fuelClass: 'Fossil', category: 'Alcohol', type: 'Methanol' },
];

// Biofuel categories with their default Lower Heating Value (manual §3.10.1.1).
export const BIOFUEL_GRADES: FuelGradeDef[] = [
  { id: 'BIODIESEL', fuelClass: 'Biofuel', category: 'Bio-diesel', type: 'Bio-diesel', defaultLhv: 37 },
  { id: 'HVO', fuelClass: 'Biofuel', category: 'HVO', type: 'HVO', defaultLhv: 44 },
  { id: 'BIOMETHANOL', fuelClass: 'Biofuel', category: 'Bio-methanol', type: 'Bio-methanol', defaultLhv: 20 },
  { id: 'BIOETHANOL', fuelClass: 'Biofuel', category: 'Bio-ethanol', type: 'Bio-ethanol', defaultLhv: 27 },
  { id: 'BIOLNG', fuelClass: 'Biofuel', category: 'Bio-LNG', type: 'Bio-LNG', defaultLhv: 50 },
  { id: 'BIOH2', fuelClass: 'Biofuel', category: 'Bio-hydrogen', type: 'Bio-hydrogen', defaultLhv: 120 },
];

export const BLEND_GRADE: FuelGradeDef = {
  id: 'BLEND',
  fuelClass: 'Blend',
  category: 'Blend',
  type: 'Blend (Fossil + Biofuel)',
};

export const ALL_GRADES: FuelGradeDef[] = [
  ...FOSSIL_GRADES,
  ...BIOFUEL_GRADES,
  BLEND_GRADE,
];

// Raw materials available for biofuels (subset from manual §3.10.1.1 tables).
export const RAW_MATERIALS: Record<string, string[]> = {
  BIODIESEL: [
    'Pure vegetable oil',
    'POME (palm oil methyl ester)',
    'FAME (fatty acid methyl ester)',
    'Rapeseed biodiesel',
    'Sunflower biodiesel',
    'Soybean biodiesel',
    'Waste cooking oil biodiesel',
    'FAEE (fatty acid ethyl ester)',
    'Used cooking oil',
    'Animal fats (cat. 1 & 2)',
    'Other',
  ],
  HVO: [
    'Hydrotreated oil of biomass origin',
    'HVO from rapeseed',
    'HVO from sunflower',
    'HVO from soybean',
    'HVO from palm oil',
    'Hydrotreated waste cooking oil',
    'Used cooking oil',
    'Animal fats (cat. 1 & 2)',
    'Other',
  ],
  BIOMETHANOL: ['Methanol from renewable sources', 'Animal manure and sewage sludge', 'Other'],
  BIOETHANOL: ['Ethanol from renewable sources', 'Straw', 'Bagasse', 'Nut shells', 'Husks', 'Other'],
  BIOLNG: ['Biogas purified to natural gas quality', 'Straw', 'Animal manure and sewage sludge', 'Other'],
  BIOH2: ['Hydrogen from renewable sources', 'Other'],
};

/** Categorise a fuel by sulphur content per IMO "Sulphur Cap 2020" (manual §3.10). */
export function sulphurCategory(sulphurPct: number): SulphurCategory {
  if (sulphurPct > 0.5) return 'HS';
  if (sulphurPct >= 0.1) return 'VLS';
  return 'ULS';
}

export const SULPHUR_LABELS: Record<SulphurCategory, string> = {
  HS: 'High sulphur (> 0.5%)',
  VLS: 'Very low sulphur (0.1–0.5%)',
  ULS: 'Ultra-low sulphur (≤ 0.1%)',
};

export function gradeById(id: string): FuelGradeDef | undefined {
  return ALL_GRADES.find((g) => g.id === id);
}
