import { Router } from 'itty-router';
import { Env } from './types/env';
import { LockInfo } from './types/terraform';

export class DurableLock {
  private state: DurableObjectState;
  private lockInfo: LockInfo | null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.lockInfo = null;
    this.state.blockConcurrencyWhile(async () => {
      this.lockInfo = (await this.state.storage.get('_lock')) || null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const router = Router();
    // non-standard routes
    router.get('/states/:projectName/lock', this.currentLockInfo.bind(this));

    // Lock
    router.put('/states/:projectName/lock', this.lock.bind(this));
    router.lock('/states/:projectName/lock', this.lock.bind(this));

    // Unlock
    router.delete('/states/:projectName/lock', this.unlock.bind(this));
    router.unlock('/states/:projectName/lock', this.unlock.bind(this));
    router.all('*', () => new Response(request.url, { status: 404 }));

    return router.handle(request);
  }

  private async lock(request: Request): Promise<Response> {
    if (this.lockInfo) return Response.json(this.lockInfo, { status: 423 });
    const lockInfo = (await request.json()) as LockInfo;
    await this.state.storage.put('_lock', lockInfo);
    this.lockInfo = lockInfo;
    return new Response();
  }

  private async unlock(request: Request): Promise<Response> {
    const lockInfo = (await request.json()) as LockInfo;
    if (!lockInfo.ID) return new Response('Missing ID for unlock state request', { status: 400 });
    if (this.lockInfo?.ID !== lockInfo.ID) return Response.json(this.lockInfo, { status: 423 });
    await this.state.storage.delete('_lock');
    this.lockInfo = null;
    return new Response();
  }

  private async currentLockInfo(request: Request): Promise<Response> {
    return Response.json(this.lockInfo || {});
  }

  private async purge(request: Request): Promise<Response> {
    this.state.storage.deleteAll();
    this.lockInfo = null;
    return new Response();
  }
}
