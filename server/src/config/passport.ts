import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';
import { env } from './env';

export const googleConfigured = Boolean(env.google.clientId && env.google.clientSecret);

/**
 * Google's ID-token payload is typed strictly by passport-google-oauth20
 * (e.g. `email_verified` is `boolean | undefined`, `verified_email` is absent),
 * but at runtime Google may send booleans OR strings, and some payloads still
 * use the legacy `verified_email` field. This permissive shape lets us handle
 * all of those without fighting the compiler.
 */
type GoogleJson = {
  email_verified?: boolean | string;
  verified_email?: boolean | string;
  hd?: string;
};

function isTruthyFlag(value: boolean | string | undefined): boolean {
  return value === true || value === 'true';
}

export function configurePassport(): boolean {
  if (!googleConfigured) {
    console.warn('[auth] Google OAuth not configured: provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the API deployment.');
    return false;
  }
  passport.use('google', new GoogleStrategy({
    clientID: env.google.clientId,
    clientSecret: env.google.clientSecret,
    callbackURL: env.serverUrl
      ? `${env.serverUrl}/api/auth/google/callback`
      : '/api/auth/google/callback',
    proxy: true,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const json = (profile._json ?? {}) as GoogleJson;

      const email = profile.emails?.[0]?.value?.trim().toLowerCase();
      if (!email) return done(new Error('Google did not share an email address.'));

      // Only accept verified Google emails; otherwise someone could claim an
      // existing password account by providing an unverified address.
      const verified =
        isTruthyFlag(json.email_verified) ||
        isTruthyFlag(json.verified_email);
      if (!verified) return done(new Error('Google did not verify this email address.'));

      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.findOne({ email });
        if (user?.googleId && user.googleId !== profile.id) {
          return done(new Error('This email is linked to another Google account.'));
        }
        // For existing password accounts, Google must be authoritative for the
        // address, not merely have verified it some time in the past.
        const domain = email.split('@')[1];
        const hostedDomain = (json.hd || '').toLowerCase();
        const authoritative = domain === 'gmail.com' || (Boolean(hostedDomain) && hostedDomain === domain);
        if (user && !authoritative) {
          return done(new Error('Existing password account cannot be automatically linked to this Google identity.'));
        }
        if (user) {
          user.googleId = profile.id;
          if (!user.avatarUrl) user.avatarUrl = profile.photos?.[0]?.value;
          await user.save();
        } else {
          user = await User.create({
            email,
            googleId: profile.id,
            name: (profile.displayName?.trim() || email.split('@')[0]).slice(0, 60),
            avatarUrl: profile.photos?.[0]?.value,
          });
        }
      }
      done(null, user as Express.User);
    } catch (error) {
      done(error as Error);
    }
  }));
  return true;
}