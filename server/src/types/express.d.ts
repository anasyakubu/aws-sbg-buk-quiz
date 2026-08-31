import type { IUser } from '../models/User';

/**
 * `@types/passport` declares `Express.User` as an empty interface and puts
 * `user?: Express.User` on `Express.Request`. Redeclaring `user` on a custom
 * request interface makes handlers incompatible with Express's `RequestHandler`
 * (TS2769). Merging our user type into `Express.User` instead means the built-in
 * `Request` already carries the right type, so no redeclaration is needed.
 */
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends IUser {}
  }
}

export {};
