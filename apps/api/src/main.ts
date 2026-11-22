import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { parseEnv } from './common/config/env';

async function bootstrap() {
  // Local development: read the repo-root .env (git-ignored). In deployment, the
  // platform sets real environment variables and there is no .env file.
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const config = parseEnv(process.env); // throws, and stops startup, if anything is wrong

  const app = await NestFactory.create(AppModule.register(config));
  configureApp(app);
  app.enableShutdownHooks(); // close cleanly on Ctrl+C or a container stop

  // No global "/api" prefix: routes declare their full path, exactly as in
  // contracts/openapi.yaml, because /.well-known/jwks.json lives outside /api.
  await app.listen(config.PORT);

  // Lets `nx serve` know the server is ready.
  if (process.env.NX_READY_SIGNAL_SOCKET) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }
  Logger.log(`API running on http://localhost:${config.PORT}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // Most likely an invalid environment: print the reason and exit, instead of a long stack.
  Logger.error(
    error instanceof Error ? error.message : String(error),
    'Bootstrap',
  );
  process.exit(1);
});
