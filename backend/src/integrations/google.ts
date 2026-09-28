import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';

export const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI,
);

export function getGoogleAuthUrl(state: string): string {
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
  });
}

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export async function verifyGoogleCode(code: string): Promise<GoogleUserInfo> {
  const { tokens } = await googleClient.getToken(code);
  googleClient.setCredentials(tokens);

  const idToken = tokens.id_token;
  if (!idToken) throw new Error('No id_token returned from Google');

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error('Empty token payload');

  return {
    googleId: payload.sub,
    email: payload.email ?? '',
    name: payload.name ?? '',
    avatarUrl: payload.picture ?? null,
  };
}
