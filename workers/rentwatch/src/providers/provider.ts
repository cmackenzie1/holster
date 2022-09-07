import { Unit } from '../models';

export interface Provider {
  name: string;
  slug: string;
  units(): Promise<Unit[]>;
}
