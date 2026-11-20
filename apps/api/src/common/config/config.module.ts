import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { AppConfig } from './env';

// Injection token for the validated config:
//   constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
export const APP_CONFIG = Symbol('APP_CONFIG');

// Global, so every module can inject APP_CONFIG without importing this one.
// The config is parsed once in main.ts (or built by hand in tests) and passed in.
@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
