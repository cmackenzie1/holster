import { Router } from 'itty-router';
import { Env } from './types/env';
import { deleteStateHandler, getStateHandler, lockStateHandler, putStateHandler } from './handlers';
import { withIdentity, withParams } from './middlewares';

export { DurableLock } from './durableLock';

const router = Router();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    router.get('/states/:projectName', withIdentity, withParams, getStateHandler);
    router.post('/states/:projectName', withIdentity, withParams, putStateHandler);
    router.delete('/states/:projectName', withIdentity, withParams, deleteStateHandler);

    router.all('/states/:projectName/lock', withIdentity, withParams, lockStateHandler);

    router.all('*', () => new Response('Not found.\n', { status: 404 }));
    return router.handle(request, env);
  },
};
