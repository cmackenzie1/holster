import { Router, Request as IttyRequest } from 'itty-router';
import { YahooFinance } from './yahoofinance';

const router = Router();

router.get('/:symbol', async (request: Request) => {
  const { params } = request as IttyRequest;
  const yahoo = new YahooFinance();
  return Response.json(await yahoo.quote(params!.symbol));
});

export interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env);
  },
};
