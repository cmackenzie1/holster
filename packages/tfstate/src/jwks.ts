import {
  createLocalJWKSet,
  JSONWebKeySet,
  JWTClaimVerificationOptions,
  jwtVerify,
  JWTVerifyOptions,
  JWTVerifyResult,
  ResolvedKey,
} from 'jose';

export class JWKS {
  private readonly url: string;
  private readonly cache: KVNamespace | undefined;
  private keys: JSONWebKeySet;

  constructor(url: string, cache?: KVNamespace) {
    this.url = url;
    this.cache = cache;
  }

  keystore() {
    return createLocalJWKSet(this.keys);
  }

  async refresh() {
    if (this.keys) return;
    if (!this.keys) this.loadFromCache();
    if (!this.keys) this.loadRemote();
  }

  /**
   * Load the keys from KV. If key is not found in KV, return.
   */
  private async loadFromCache() {
    const data = await this.cache?.get(this.url);
    if (!data) return;
    this.keys = JSON.parse(data) as JSONWebKeySet;
  }

  /**
   * Load the key from remote url and then persist to KV.
   */
  private async loadRemote() {
    const resp = await fetch(this.url);
    if (!resp.ok) throw new Error(`Failed to fetch remote JWKS - ${resp.statusText}`);
    const data = await resp.text();
    this.cache?.put(this.url, data, { expirationTtl: 24 * 60 * 60 });
    this.keys = JSON.parse(data) as JSONWebKeySet;
  }

  /**
   * Verify the JWT against the JWK Set. Refreshing the JWKS from remote if
   * decoding fails and trying again.
   */
  async verify(jwt: string, options?: JWTVerifyOptions): Promise<JWTVerifyResult & ResolvedKey> {
    try {
      return jwtVerify(jwt, this.keystore(), options);
    } catch (err) {
      await this.loadRemote();
    }
    return jwtVerify(jwt, this.keystore(), options);
  }
}
