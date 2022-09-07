import { Unit } from '../../models';
import { slug } from '../../slug';
import { Provider } from '../provider';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';

interface PropertyFloorplanSummary {
  propertyFloorplansSummary: PropertyFloorplans[];
}

interface PropertyFloorplans {
  floorplanId: string;
  floorplanName: string;
  floorplanTag: string;
  bathroomMin: number;
  bathroomMax: number;
  bedroomMin: number;
  bedroomMax: number;
  priceMin: number;
  priceMax: number;
  sqftMin: number;
  sqFtMax: number;
}

const propertyQuery = gql`
  query Properties($amliPropertyId: ID!, $propertyId: ID!) {
    propertyFloorplansSummary(amliPropertyId: $amliPropertyId, propertyId: $propertyId) {
      floorplanId
      floorplanName
      floorplanTag
      bathroomMin
      bathroomMax
      bedroomMin
      bedroomMax
      priceMin
      priceMax
      sqftMin
      sqFtMax
      unitCount
      availableUnitCount
      units
    }
  }
`;

export class Amli implements Provider {
  name: string;
  slug: string;
  private readonly cache: InMemoryCache;
  private readonly client: ApolloClient<any>;
  private readonly propertyId: string;
  private readonly amliPropertyId: string;

  constructor(name: string, propertyId: string, amliPropertyId: string) {
    this.name = name;
    this.slug = slug(name);
    this.cache = new InMemoryCache();
    this.client = new ApolloClient({
      uri: 'https://prodeastgraph.amli.com/graphql',
      cache: this.cache,
    });
    this.propertyId = propertyId;
    this.amliPropertyId = amliPropertyId;
  }

  async rents() {
    const { data, error } = await this.client.query({
      query: propertyQuery,
      variables: { propertyId: this.propertyId, amliPropertyId: this.amliPropertyId },
    });
    if (error) throw new Error(`Unable to fetch data for AMLI Property: ${this.name}`);
    const { propertyFloorplansSummary } = data as PropertyFloorplanSummary;
    return propertyFloorplansSummary;
  }

  async units(): Promise<Unit[]> {
    const units: Unit[] = [];
    const data = await this.rents();
    data.forEach((floorplan) => {
      units.push({
        id: floorplan.floorplanId,
        floorplan: {
          id: floorplan.floorplanId,
          label: floorplan.floorplanName,
        },
        beds: floorplan.bedroomMax,
        baths: floorplan.bathroomMax,
        sqft: { min: floorplan.sqftMin, max: floorplan.sqFtMax },
        rent: { min: floorplan.priceMin, max: floorplan.priceMax },
      });
    });
    return units;
  }
}

export const amliArc = () => new Amli('AMLI Arc', 'XK-A2xAAAB8A_JrR', '89240');
export const amliWallingford = () => new Amli('AMLI Wallingford', 'XK-AAxAAACEA_JcG', '89178');
export const amliMark24 = () => new Amli('AMLI Mark24', 'XHSPIxIAACIAbhlr', '88786');
export const amli535 = () => new Amli('AMLI 535', 'XFJHfhMAACIANSgJ', '88146');
export const amliSLU = () => new Amli('AMLI SLU', 'XHSQBhIAAB8Abh1Y', '88848');
export const amliBellevueSpringDistrict = () => new Amli('AMLI Bellevue Spring District', 'XMxVmCwAADkA1DMw', '89407');
export const amliBellevuePark = () => new Amli('AMLI Bellevue Park', 'XFJHVxMAACQANSdY', '85263');
