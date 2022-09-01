export interface Env {
  TFSTATE_BUCKET: R2Bucket;
  TFSTATE_LOCK: DurableObjectNamespace;

  AUTH0_ISSUER: string;
  AUTH0_AUDIENCE: string;
  AUTH0_JWKS_URL: string;
  AUTH0_CLIENT_ID: string;
  // private
  AUTH0_CLIENT_SECRET: string;
}
