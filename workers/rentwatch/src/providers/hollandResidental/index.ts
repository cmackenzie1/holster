import { MinMax, Unit } from '../../models';
import { slug } from '../../slug';
export interface HollandResidentalUnit {
  id: string;
  building_id: string;
  floor_id: string;
  model_id: string;
  beds: number;
  baths: number;
  sqft: MinMax;
  rent: MinMax;
  deposit: number;
  applyUrl: string;
  available: boolean | Date;
}

export interface HollandResidentalModel {
  id: string;
  label: string;
}

export class HollandResidental {
  name: string;
  slug: string;
  private readonly saas_id: string;

  constructor(name: string, saas_id: string) {
    this.name = name;
    this.slug = slug(name);
    this.saas_id = saas_id;
  }

  async rents() {
    const url = new URL('https://www.hollandresidential.com/api/v1/content');
    url.searchParams.set('saas_id', this.saas_id);
    const req = new Request(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:104.0) Gecko/20100101 Firefox/104.0',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    const resp = await fetch(req);
    if (!resp.ok) throw new Error(`Unable to fetch latest data from Holland Residental Property: ${this.name}`);
    return resp;
  }

  async units(): Promise<Unit[]> {
    const units: Unit[] = [];
    const data = (await (await this.rents()).json()) as {
      units: HollandResidentalUnit[];
      models: HollandResidentalModel[];
    };
    data.units.forEach((unit) => {
      units.push({
        id: unit.id || '',
        floorplan: {
          id: unit.model_id,
          label: data.models
            .filter((model) => {
              model.id === unit.model_id;
            })
            .pop()?.label,
        },
        beds: unit.beds,
        baths: unit.baths,
        sqft: unit.sqft,
        rent: unit.rent,
        deposit: { min: unit.deposit, max: unit.deposit },
      } as Unit);
    });
    return units as Unit[];
  }
}

export const iveyOnBoren = () => new HollandResidental('Ivey on Boren', 'Hiz4GtgjzZhE2rL4y');
export const kiara = () => new HollandResidental('Kiara', 'v2MCbAhp2qPsB2GZg');
export const dimension = () => new HollandResidental('Dimension', 'Gi8N4BuzsdrPYjmWL');
export const huxley = () => new HollandResidental('The Huxley', 'mCpv7WScnT9XoYMLd');
export const oneLakefront = () => new HollandResidental('One Lakefront', 'aJRHh8cQ6cbHnq5JH');
export const juxt = () => new HollandResidental('JUXT', 'RRfBiZh3PfLMjnwPA');
