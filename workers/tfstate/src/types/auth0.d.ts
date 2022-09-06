import { JWTPayload } from 'jose';

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
  token_type: 'Bearer';
}

export interface UserInfo extends JWTPayload {
  name?: string;
  nickname?: string;
  email?: string;
  email_verified?: boolean;
  namespaceId?: string;
}
