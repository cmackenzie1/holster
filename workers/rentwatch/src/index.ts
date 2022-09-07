/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import {
  amli535,
  amliArc,
  amliBellevuePark,
  amliBellevueSpringDistrict,
  amliMark24,
  amliSLU,
  amliWallingford,
} from './providers/amli';
import { dimension, huxley, iveyOnBoren, kiara, oneLakefront } from './providers/hollandResidental';
import { Provider } from './providers/provider';

export interface Env {
  RENTWATCH_BUCKET: R2Bucket;
}

const providers: Provider[] = [
  iveyOnBoren(),
  dimension(),
  kiara(),
  huxley(),
  oneLakefront(),
  amliArc(),
  amliWallingford(),
  amliMark24(),
  amli535(),
  amliBellevuePark(),
  amliBellevueSpringDistrict(),
  amliSLU(),
];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const results = await collectData(env);
    return Response.json(results);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const results = await collectData(env);
    return Response.json(results);
  },
};

export const yyyymmdd = (date: Date | number) => {
  if (date instanceof Date) return date.toLocaleDateString('en-CA'); // trick to get format yyyy-mm-dd
  if (typeof date === 'number') return new Date(date).toLocaleDateString('en-CA');
};

export const collectData = async (env: Env) => {
  const now = Date.now();

  const promises = providers.map((p) =>
    (async () => {
      return { slug: p.slug, name: p.name, units: await p.units() };
    })(),
  );

  const values = await Promise.allSettled(promises);

  const results: { slug: string; status: 'fulfilled' | 'rejected' }[] = [];
  for (const value of values) {
    if (value.status === 'rejected') {
      console.log('failed with error:', JSON.stringify(value));
      continue;
    }
    const { slug, units } = value.value;
    await env.RENTWATCH_BUCKET.put(`${yyyymmdd(now)}/${slug}`, JSON.stringify(units), {
      httpMetadata: { contentType: 'application/json' },
    });
    results.push({
      slug: slug,
      status: value.status,
    });
  }
  return results;
};
