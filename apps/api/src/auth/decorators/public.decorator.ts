import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

// Every route needs an access token by default (the JWT guard is global).
// @Public() opts a route out: login, refresh, logout and the JWKS.
export const Public = () => SetMetadata(IS_PUBLIC, true);
