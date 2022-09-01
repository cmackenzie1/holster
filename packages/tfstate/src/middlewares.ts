import { Request as IttyRequest } from 'itty-router';
import { RefreshTokenResponse } from './types/auth0';
import { Env } from './types/env';
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';

export interface RouteParams {
  namespaceId: string | undefined;
}

export function withParams(request: Request & RouteParams) {
  const { params } = request as IttyRequest;
  request.namespaceId = params?.namespaceId;
}

export async function withIdentity(
  request: Request & { username?: string; auth0?: RefreshTokenResponse },
  env: Env,
): Promise<Response | undefined> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return undefined;

  const [_, credentials] = authorization.split(' ');
  const [username, refresh_token] = atob(credentials).split(':');

  const resp = await fetch('https://mirio.us.auth0.com/oauth/token', {
    method: 'post',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.AUTH0_CLIENT_ID,
      client_secret: env.AUTH0_CLIENT_SECRET,
      refresh_token,
    }),
  });

  if (!resp.ok) return resp;
  const authInfo = (await resp.json()) as RefreshTokenResponse;
  request.auth0 = authInfo;
  request.username = username;
  return undefined;
}

export function jwtCheck(url: string, audience: string, issuer: string, algorithms: ['RS256']) {
  const jwks = createRemoteJWKSet(new URL(url));
  return async (request: Request & { auth0?: RefreshTokenResponse; jwt?: { payload?: JWTPayload } }) => {
    let token: string = '';
    if (request.auth0) {
      token = request.auth0.id_token;
    } else {
      const authorization = request.headers.get('Authorization');
      if (!authorization) return new Response('No authorization header provided.', { status: 401 });

      const [bearer, bearerToken] = authorization.split(' ');
      if (bearer !== 'Bearer') return new Response('Authorization header not in Bearer format.', { status: 401 });
      token = bearerToken;
    }

    try {
      const result = await jwtVerify(token, jwks, { issuer, audience, algorithms });
      request.jwt = { ...result };
      return undefined;
    } catch (e) {
      console.log(e);
      console.log(request.auth0);
      return new Response('Invalid JWT.', { status: 401 });
    }
  };
}
