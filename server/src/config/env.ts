import dotenv from 'dotenv';
dotenv.config();

const required = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${key}`);
  return v;
};

// CLIENT_URL may hold a comma-separated list so Vercel preview deployments
// (e.g. https://my-app-git-branch.vercel.app) can be allowed alongside prod.
const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // First entry is the canonical client, used for OAuth redirects.
  clientUrl: clientUrls[0],
  allowedOrigins: clientUrls,

  // Public origin of this API, e.g. https://sbg-buk-quiz-api.vercel.app
  // Lets Google OAuth build an absolute callback URL when running behind a proxy.
  serverUrl: (process.env.SERVER_URL || '').replace(/\/$/, ''),

  mongoUri: required('MONGODB_URI', 'mongodb://localhost:27017/sbg-buk-quiz'),
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-in-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  openaiKey: process.env.OPENAI_API_KEY || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
};
