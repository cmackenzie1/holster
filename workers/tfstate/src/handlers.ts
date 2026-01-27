import type { Env } from "./types/env";
import type { RequestWithIdentity } from "./types/request";
import type { LockInfo } from "./types/terraform";
import { getObjectKey } from "./utils";

/**
 * Returns the current remote state from the durable storage. Doesn't support locking
 * GET /states/:projectName
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L144
 * @param request
 * @param env
 */
export const getStateHandler = async (
	request: RequestWithIdentity,
	env: Env,
) => {
	const { projectName } = request;
	const username = request.identity?.userInfo?.username || "";
	if (!projectName || projectName === "")
		return new Response("No project name specified.", { status: 400 });
	if (!username || username === "")
		return new Response("Unable to determine username", { status: 500 });
	const state = await env.TFSTATE_BUCKET.get(getObjectKey(username, projectName));
	if (state === null) return new Response(null, { status: 204 });
	return new Response(await state?.arrayBuffer(), {
		headers: { "content-type": "application/json" },
	});
};

/**
 * Updates the remote state in the durable storage. Supports locking.
 * POST /states/:projectName?ID=<lockID>
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L203
 * @param request
 * @param env
 */
export const putStateHandler = async (
	request: RequestWithIdentity,
	env: Env,
) => {
	const { projectName, url } = request;
	const username = request.identity?.userInfo?.username || "";
	if (!projectName || projectName === "")
		return new Response("No project name specified.", { status: 400 });
	if (!username || username === "")
		return new Response("Unable to determine username", { status: 500 });

	const key = getObjectKey(username, projectName);
	const id = env.TFSTATE_LOCK.idFromName(key);
	const lock = env.TFSTATE_LOCK.get(id);
	const lockResp = await lock.fetch(
		`https://lock.do/states/${projectName}/lock`,
	);
	const lockInfo = (await lockResp.json()) as LockInfo;

	// Lock present, ensure the update request has the correct lock ID
	if (lockInfo.ID) {
		const lockId = new URL(url).searchParams.get("ID");
		if (lockInfo.ID !== lockId) return Response.json(lockInfo, { status: 423 });
	}

	await env.TFSTATE_BUCKET.put(key, await request.arrayBuffer());
	return new Response();
};

/**
 * Deletes the remote state in the durable storage.
 * Does not support/honor locking.
 * DELETE /states/:projectName
 * https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/backend/remote-state/http/client.go#L241
 * @param request
 * @param env
 */
export const deleteStateHandler = async (
	request: RequestWithIdentity,
	env: Env,
) => {
	const { projectName, url } = request;
	const username = request.identity?.userInfo?.username || "";
	if (!projectName || projectName === "")
		return new Response("No project name specified.", { status: 400 });
	if (!username || username === "")
		return new Response("Unable to determine username", { status: 500 });

	const key = getObjectKey(username, projectName);
	const id = env.TFSTATE_LOCK.idFromName(key);
	const lock = env.TFSTATE_LOCK.get(id);
	const lockResp = await lock.fetch(
		`https://lock.do/states/${projectName}/lock`,
	);
	const lockInfo = (await lockResp.json()) as LockInfo;

	// Lock present, prevent delete entirely.
	if (lockInfo.ID) return Response.json(lockInfo, { status: 423 });

	await env.TFSTATE_BUCKET.delete(getObjectKey(username, projectName));
	return new Response();
};

/**
 * Lock or Unlock the remote state for edits.
 * PUT/DELETE /states/:projectName/lock
 * @param request
 */
export const lockStateHandler = async (
	request: RequestWithIdentity,
	env: Env,
) => {
	const { projectName } = request;
	const username = request.identity?.userInfo?.username || "";
	if (!projectName || projectName === "")
		return new Response("No project name specified.", { status: 400 });
	if (!username || username === "")
		return new Response("Unable to determine username", { status: 500 });
	const id = env.TFSTATE_LOCK.idFromName(getObjectKey(username, projectName));
	const lock = env.TFSTATE_LOCK.get(id);
	return lock.fetch(request);
};
