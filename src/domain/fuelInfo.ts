// "Information" panel + "Remaining on board" logic (manual §3.10, §7.4).
// The panel groups fuel ROB by sulphur category (HS/VLS/ULS) and by the fuel
// groups the manual lists: LFO/HFO, MDO/MGO, Gas/Alcohol, Bio-diesel, HVO,
// Other (Biofuel) and Blend.

import type { FuelOnboard, SulphurCategory } from './types';
import { gradeById } from '../data/fuels';

export const SULPHUR_ORDER: SulphurCategory[] = ['ULS', 'VLS', 'HS'];

/** Map a fuel grade to the manual's Information-panel fuel group. */
export function fuelGroup(gradeId: string): string {
  const g = gradeById(gradeId);
  if (!g) return 'Other';
  if (g.fuelClass === 'Blend') return 'Blend';
  switch (g.category) {
    case 'LFO':
    case 'HFO':
      return 'LFO/HFO';
    case 'MDO/MGO':
      return 'MDO/MGO';
    case 'Gaseous':
    case 'Alcohol':
      return 'Gas/Alcohol';
    case 'Bio-diesel':
      return 'Bio-diesel';
    case 'HVO':
      return 'HVO';
    default:
      return 'Other (Biofuel)';
  }
}

export interface RobBySulphur {
  ULS: number;
  VLS: number;
  HS: number;
  total: number;
}

export function robBySulphur(fuels: FuelOnboard[]): RobBySulphur {
  const out: RobBySulphur = { ULS: 0, VLS: 0, HS: 0, total: 0 };
  for (const f of fuels) {
    out[f.sulphurCategory] += f.rob;
    out.total += f.rob;
  }
  return out;
}

export interface RobGroup {
  group: string;
  mt: number;
  fuels: FuelOnboard[];
}

export function robByGroup(fuels: FuelOnboard[]): RobGroup[] {
  const map = new Map<string, RobGroup>();
  for (const f of fuels) {
    const group = fuelGroup(f.gradeId);
    if (!map.has(group)) map.set(group, { group, mt: 0, fuels: [] });
    const g = map.get(group)!;
    g.mt += f.rob;
    g.fuels.push(f);
  }
  return [...map.values()].sort((a, b) => b.mt - a.mt);
}

export const SULPHUR_COLOR: Record<SulphurCategory, string> = {
  ULS: 'var(--ok)',
  VLS: 'var(--accent)',
  HS: 'var(--err)',
};
