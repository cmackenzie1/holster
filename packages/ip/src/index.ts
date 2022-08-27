import { Router, Request as IttyRequest } from 'itty-router';
export interface Env {}

const router = Router();
router.get('/', (request: Request) => {
  const ip = request.headers.get('cf-connecting-ip') || '';
  return new Response(`${ip}\n`, {
    headers: {
      'content-type': 'text/plain',
    },
  });
});

router.get('/:property', (request: Request) => {
  const { params } = request as IttyRequest;
  if (!params) return new Response(null, { status: 204 });
  const { cf } = request;
  if (!cf) return new Response(null, { status: 204 });
  let prop: any = 'unknown';
  switch (params.property) {
    case 'asn':
      prop = request.cf?.asn || 'unknown';
      break;
    case 'aso':
      prop = request.cf?.asOrganization || 'unknown';
      break;
    case 'colo':
      prop = request.cf?.colo || 'unknown';
      break;
    case 'city':
      prop = request.cf?.city || 'unknown';
      break;
    case 'country':
      prop = request.cf?.country || 'unknown';
      break;
    case 'latlong':
      const lat = request.cf?.latitude || 'unknown';
      const long = request.cf?.longitude || 'unknown';
      return new Response(`${lat},${long}\n`, {
        headers: { 'content-type': 'text/csv', 'content-disposition': 'inline' },
      });
    case 'region':
      prop = request.cf?.region || 'unknown';
      break;
    case 'tlsCipher':
      prop = request.cf?.tlsCipher || 'unknown';
      break;
    case 'tlsVersion':
      prop = request.cf?.tlsVersion || 'unknown';
      break;
    case 'timezone':
      prop = request.cf?.timezone || 'unknown';
      break;
    default:
      return new Response('Not found.\n', { status: 404 });
  }
  return new Response(`${prop}\n`, {
    headers: {
      'content-type': 'text/plain',
    },
  });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request);
  },
};
