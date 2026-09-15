import type { CatalogTimestamped } from './catalog';

export interface UnitConversion {
  id: string;
  from_unit_id: string;
  to_unit_id: string;
  multiplier: string;
  is_active: boolean;
}

export interface Unit extends CatalogTimestamped {
  id: string;
  uuid?: string;
  code: string;
  name: string;
  type: string;
  is_base: boolean;
  precision: number;
  is_active: boolean;
  conversions?: UnitConversion[];
}
