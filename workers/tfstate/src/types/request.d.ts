export interface UserInfo {
  username: string;
  namespaceId?: string;
}

export interface RequestWithIdentity extends Request {
  identity?: {
    userInfo?: UserInfo;
  };
}
