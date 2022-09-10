export interface Env {
  // tfstate storage and locking
  TFSTATE_BUCKET: R2Bucket;
  TFSTATE_LOCK: DurableObjectNamespace;
}
