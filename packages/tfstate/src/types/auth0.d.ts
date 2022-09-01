export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
  token_type: 'Bearer';
}
