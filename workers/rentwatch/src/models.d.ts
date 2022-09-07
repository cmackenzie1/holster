export interface MinMax {
  min: number;
  max: number;
}

export interface Floorplan {
  id: string;
  label: string;
}

export interface Unit {
  id: string;
  floorplan: Floorplan;
  beds: number;
  baths: number;
  sqft: MinMax;
  rent: MinMax;
  deposit?: MinMax;
  description?: string;
}
