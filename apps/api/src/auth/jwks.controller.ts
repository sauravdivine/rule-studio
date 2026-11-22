import { Controller, Get, Header } from '@nestjs/common';
import type { Jwks } from '@rule-studio/shared-types';
import { Public } from './decorators/public.decorator';
import { TokenService } from './token.service';

// The public key set. Anything that receives one of our access tokens can verify it with
// this, without sharing a secret (spec 002, RS256 + JWKS).
@Controller('.well-known')
export class JwksController {
  constructor(private readonly tokens: TokenService) {}

  @Public()
  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  jwks(): Jwks {
    return { keys: [this.tokens.publicJwk()] };
  }
}
