import { Request as IttyRequest } from 'itty-router';
import { Env } from './types/env';
import { RequestWithIdentity } from './types/request';

export interface RouteParams {
  projectName: string | undefined;
}

export function withParams(request: Request & RouteParams) {
  const { params } = request as IttyRequest;
  request.projectName = params?.projectName;
}

export async function withIdentity(request: Request & RequestWithIdentity, env: Env): Promise<Response | undefined> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('No authentication information provided.', { status: 401 });

  const [basic, credentials] = authorization.split(' ');
  if (basic !== 'Basic') return new Response('Only Basic authentication scheme is supported.', { status: 401 });

  const [username, token] = atob(credentials).split(':');
  if (!username || username === '') return new Response('Username cannot be empty.', { status: 401 });
  if (!token || token === '') return new Response('Password cannot be empty.', { status: 401 });
  request.identity = { userInfo: { username } };
  return undefined;
}
