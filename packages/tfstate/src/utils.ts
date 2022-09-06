import { RefreshTokenResponse, UserInfo } from './types/auth0';

export const getObjectKey = (email: string, projectName: string) => `${email}/${projectName}.tfstate`;

export const getOAuthTokenViaRefreshToken = async (
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<RefreshTokenResponse> => {
  const resp = await fetch('https://mirio.us.auth0.com/oauth/token', {
    method: 'post',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!resp.ok) throw new Error('Failed to exchange credentials for OAuth token.');
  return (await resp.json()) as RefreshTokenResponse;
};

export const getUserInfo = async (accessToken: string) => {
  const resp = await fetch('https://mirio.us.auth0.com/userinfo', {
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error('Failed to retrieve /userinfo');
  return (await resp.json()) as UserInfo;
};
