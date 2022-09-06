// LockInfo
// https://github.com/hashicorp/terraform/blob/cb340207d8840f3d2bc5dab100a5813d1ea3122b/internal/states/statemgr/locker.go#L115
export interface LockInfo {
  ID: string;
  Operation: string;
  Info: string;
  Who: string;
  Version: string;
  Created: string;
  Path: string;
}
