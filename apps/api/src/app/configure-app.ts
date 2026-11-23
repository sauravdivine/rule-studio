import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

// HTTP setup shared by main.ts and the tests, so tests run the app exactly as it runs for real.
export function configureApp(app: INestApplication): void {
  const expressApp = app as NestExpressApplication;
  expressApp.disable('x-powered-by'); // don't advertise the framework
  // Express would add its own weak ETag (a hash of the body) to every response,
  // even errors. Our ETags are ruleset revisions used for optimistic locking
  // (spec 003), set explicitly; a body-hash ETag sent back in If-Match would be
  // meaningless, so turn Express's off.
  expressApp.disable('etag');
  expressApp.use(cookieParser()); // fills request.cookies, where the refresh token arrives
}
