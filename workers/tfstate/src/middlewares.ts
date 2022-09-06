import { Request as IttyRequest } from 'itty-router';
import { RefreshTokenResponse } from './types/auth0';
import { Env } from './types/env';
import { JWKS } from './jwks';
import { buf2hex, sha256 } from './sha256';
import { RequestWithIdentity } from './types/request';
import { getOAuthTokenViaRefreshToken, getUserInfo } from './utils';
import { decodeJwt } from 'jose';

export interface RouteParams {
  projectName: string | undefined;
}

export function withParams(request: Request & RouteParams) {
  const { params } = request as IttyRequest;
  request.projectName = params?.projectName;
}

export async function withIdentity(request: Request & RequestWithIdentity, env: Env): Promise<Response | undefined> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('No authentiation information provided.', { status: 401 });

  const [basic, credentials] = authorization.split(' ');
  if (basic !== 'Basic') return new Response('Only Basic authentication scheme is supported.', { status: 401 });

  const [username, token] = atob(credentials).split(':');
  if (!username || username === '') return new Response('Username cannot be empty.', { status: 401 });
  if (!token || token === '') return new Response('Password cannot be empty.', { status: 401 });

  // Exchange refresh token for an ID and Access token
  const refreshToken = await getOAuthTokenViaRefreshToken(env.AUTH0_CLIENT_ID, env.AUTH0_CLIENT_SECRET, token);
  const userInfo = await getUserInfo(refreshToken.access_token);
  request.identity = { refreshToken, userInfo };
  return undefined;
}

export function jwtCheck(jwks: JWKS, audience: string, issuer: string, algorithms: ['RS256']) {
  return async (request: Request & RequestWithIdentity) => {
    const token: string = request.identity?.refreshToken?.id_token;
    try {
      const result = await jwks.verify(token, { issuer, algorithms });
      request.identity.claims = { ...result };
      return undefined;
    } catch (e) {
      return new Response('Invalid authentiation.', { status: 401 });
    }
  };
}
