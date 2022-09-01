import { Router } from 'itty-router';
import { Env } from './types/env';
import { deleteStateHandler, getStateHandler, lockStateHandler, putStateHandler } from './handlers';
import { withIdentity, withParams, jwtCheck } from './middlewares';

export { DurableLock } from './durableLock';

const router = Router();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    router.get('/login', (request: Request, env: Env) => {
      return new Response(
        `<a href="https://mirio.us.auth0.com/authorize?response_type=code&client_id=WwJSfQnDjCWoXvg2yJXbOfaaKz3N6jUU&redirect_uri=https://tfstate.mirio.dev/auth/token&scope=openid%20profile%20offline_access&state=xyzABC123">
      Sign In
    </a>`,
        { headers: { 'content-type': 'text/html' } },
      );
    });

    router.get('/auth/token', (request: Request, env: Env) => {
      const { searchParams } = new URL(request.url);
      const code = searchParams.get('code');
      return fetch('https://mirio.us.auth0.com/oauth/token', {
        method: 'post',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: env.AUTH0_CLIENT_ID,
          client_secret: env.AUTH0_CLIENT_SECRET,
          code: code,
          redirect_uri: 'https://tfstate.mirio.dev/auth/token',
        }),
      });
    });

    router.all('*', withIdentity, jwtCheck(env.AUTH0_JWKS_URL, env.AUTH0_AUDIENCE, env.AUTH0_ISSUER, ['RS256']));
    router.get('/:namespaceId/v1', withParams, getStateHandler);
    router.post('/:namespaceId/v1', withParams, putStateHandler);
    router.delete('/:namespaceId/v1', withParams, deleteStateHandler);

    router.all('/:namespaceId/v1/lock', withParams, lockStateHandler);
    router.all('/:namespaceId/v1/lock/purge', withParams, lockStateHandler);

    router.all('*', () => new Response('Not found.\n', { status: 404 }));
    return router.handle(request, env);
  },
};
