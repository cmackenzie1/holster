import { Env } from './types/env';
import { RouteParams } from './middlewares';

/**
 * Returns the current remote state from the durable storage. Doesn't support locking
 * GET /:namespaceId/:key
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L144
 * @param request
 */
export const getStateHandler = async (request: Request & RouteParams, env: Env) => {
  const { namespaceId } = request;
  if (!namespaceId) return new Response('Bad request.', { status: 400 });
  const state: R2ObjectBody = await env.TFSTATE_BUCKET.get(namespaceId);
  if (state === null) return new Response(null, { status: 204 });
  return new Response(await state?.arrayBuffer(), { headers: { 'content-type': 'application/json' } });
};

/**
 * Updates the remote state in the durable storage. Supports locking.
 * POST /:namespaceId/:key?ID=<lockID>
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L203
 * @param request
 */
export const putStateHandler = async (request: Request & RouteParams, env: Env) => {
  const { namespaceId } = request;
  if (!namespaceId) return new Response('Bad request.', { status: 400 });
  const state = await env.TFSTATE_BUCKET.put(namespaceId, await request.arrayBuffer());
  return new Response();
};

/**
 * Deletes the remote state in the durable storage.
 * Does not support/honor locking.
 * DELETE /:namespaceId/:key
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L241
 * @param request
 */
export const deleteStateHandler = async (request: Request & RouteParams, env: Env) => {
  const { namespaceId } = request;
  if (!namespaceId) return new Response('Bad request.', { status: 400 });
  const state = await env.TFSTATE_BUCKET.delete(namespaceId);
  return new Response();
};

/**
 * Locks or Unlocks the remote state for editing.
 * @param request
 */
export const lockStateHandler = async (request: Request & RouteParams, env: Env) => {
  const { namespaceId } = request;
  console.log(namespaceId);
  if (namespaceId === undefined) return new Response('Bad request.', { status: 400 });
  const id = env.TFSTATE_LOCK.idFromName(namespaceId);
  const lock = await env.TFSTATE_LOCK.get(id);
  return lock.fetch(request);
};
