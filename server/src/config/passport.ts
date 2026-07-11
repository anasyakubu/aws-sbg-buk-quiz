import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';
import { env } from './env';

export function configurePassport(): boolean {
  if (!env.google.clientId || !env.google.clientSecret) {
    console.log('[auth] Google OAuth disabled (no GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
    return false;
  }
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.google.clientId,
        clientSecret: env.google.clientSecret,
        callbackURL: '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('Google account has no email'));
          let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
          if (!user) {
            user = await User.create({
              email,
              googleId: profile.id,
              name: profile.displayName || email.split('@')[0],
              avatarUrl: profile.photos?.[0]?.value,
            });
          } else if (!user.googleId) {
            user.googleId = profile.id;
            if (!user.avatarUrl) user.avatarUrl = profile.photos?.[0]?.value;
            await user.save();
          }
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
  return true;
}
