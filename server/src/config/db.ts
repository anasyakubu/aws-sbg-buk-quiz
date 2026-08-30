import mongoose from 'mongoose';
import { env } from './env';

// Serverless functions are re-invoked constantly, and each cold start would
// otherwise open a fresh pool and exhaust Atlas connections. Cache the promise
// on globalThis so warm invocations reuse the same connection.
type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalCache = globalThis as unknown as { _mongoose?: MongooseCache };
const cached: MongooseCache = globalCache._mongoose ?? (globalCache._mongoose = { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(env.mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
      })
      .then(m => {
        console.log(`[db] connected to ${m.connection.name}`);
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow a retry on the next invocation
    throw err;
  }
  return cached.conn;
}
