import type { IRequest } from "itty-router";

export interface UserInfo {
	username: string;
	namespaceId?: string;
}

export interface RequestWithIdentity extends IRequest {
	identity?: {
		userInfo?: UserInfo;
	};
}
