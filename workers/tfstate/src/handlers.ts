import { Env } from './types/env';
import { RouteParams } from './middlewares';
import { RequestWithIdentity } from './types/request';
import { getObjectKey } from './utils';

/**
 * Returns the current remote state from the durable storage. Doesn't support locking
 * GET /states/:projectName
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L144
 * @param request
 */
export const getStateHandler = async (request: RequestWithIdentity & RouteParams, env: Env) => {
  const { identity, projectName } = request;
  const { email } = identity.userInfo;
  if (!projectName) return new Response('No project name specified.', { status: 400 });
  if (!email) return new Response('Unable to determine email', { status: 500 });
  const state: R2ObjectBody = await env.TFSTATE_BUCKET.get(getObjectKey(email, projectName));
  if (state === null) return new Response(null, { status: 204 });
  return new Response(await state?.arrayBuffer(), { headers: { 'content-type': 'application/json' } });
};

/**
 * Updates the remote state in the durable storage. Supports locking.
 * POST /states/:projectName?ID=<lockID>
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L203
 * @param request
 */
export const putStateHandler = async (request: RequestWithIdentity & RouteParams, env: Env) => {
  const { identity, projectName } = request;
  const { email } = identity.userInfo;
  if (!projectName) return new Response('No project name specified.', { status: 400 });
  if (!email) return new Response('Unable to determine email', { status: 500 });
  const state = await env.TFSTATE_BUCKET.put(getObjectKey(email, projectName), await request.arrayBuffer());
  return new Response();
};

/**
 * Deletes the remote state in the durable storage.
 * Does not support/honor locking.
 * DELETE /states/:projectName
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L241
 * @param request
 */
export const deleteStateHandler = async (request: RequestWithIdentity & RouteParams, env: Env) => {
  const { identity, projectName } = request;
  const { email } = identity.userInfo;
  if (!projectName) return new Response('No project name specified.', { status: 400 });
  if (!email) return new Response('Unable to determine email', { status: 500 });
  const state = await env.TFSTATE_BUCKET.delete(getObjectKey(email, projectName));
  return new Response();
};

/**
 * Lock or Unlock the remote state for edits.
 * PUT/DELETE /states/:projectName/lock
 * @param request
 */
export const lockStateHandler = async (request: RequestWithIdentity & RouteParams, env: Env) => {
  const { identity, projectName } = request;
  const { email } = identity.userInfo;
  if (!projectName) return new Response('No project name specified.', { status: 400 });
  if (!email) return new Response('Unable to determine email', { status: 500 });
  const id = env.TFSTATE_LOCK.idFromName(getObjectKey(email, projectName));
  const lock = env.TFSTATE_LOCK.get(id);
  return lock.fetch(request);
};
