import { IRequest } from 'itty-router';
import { Env } from './types/env';
import { RequestWithIdentity } from './types/request';

export function withParams(request: IRequest) {
  const { params } = request;
  request.projectName = params?.projectName;
}

export async function withIdentity(request: Request & RequestWithIdentity, env: Env): Promise<Response | undefined> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('No authentication information provided.', { status: 401 });

  const [basic, credentials] = authorization.split(' ');
  if (basic !== 'Basic') return new Response('Only Basic authentication scheme is supported.', { status: 401 });

  const [username, token] = Buffer.from(credentials, 'base64').toString().split(':');
  if (!username || username === '') return new Response('Username cannot be empty.', { status: 401 });
  if (!token || token === '') return new Response('Password cannot be empty.', { status: 401 });
  request.identity = { userInfo: { username } };
  return undefined;
}
