import { JWTPayload } from 'jose';
import { RefreshTokenResponse, UserInfo } from './auth0';

export interface RequestWithIdentity extends Request {
  identity?: {
    refreshToken?: RefreshTokenResponse;
    userInfo?: UserInfo;
    claims?: JWTPayload;
  };
}
