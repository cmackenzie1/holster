export interface Env {
  // tfstate storage and locking
  TFSTATE_BUCKET: R2Bucket;
  TFSTATE_LOCK: DurableObjectNamespace;

  // Auth0 App and JWT Validation
  JWKS: KVNamespace;
  AUTH0_ISSUER: string;
  AUTH0_AUDIENCE: string;
  AUTH0_JWKS_URL: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string; // private
}
