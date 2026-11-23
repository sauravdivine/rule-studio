import {
  BadRequestException,
  createParamDecorator,
  HttpException,
  HttpStatus,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

// Optimistic locking (spec 003). Every change request must say which revision it
// was based on, as the ETag it last received: If-Match: "14".
//   - missing       → 428 Precondition Required (no client can skip the check)
//   - not an ETag   → 400
//   - out of date   → 412, decided by the service
export function parseIfMatch(header: string | undefined): number {
  if (header === undefined || header.trim() === '') {
    throw new HttpException(
      {
        detail:
          'Send If-Match with the ETag from your last read of this ruleset, e.g. If-Match: "14".',
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
  const match = /^"(\d{1,9})"$/.exec(header.trim());
  if (!match) {
    throw new BadRequestException({
      detail: 'If-Match must be a single ETag like "14".',
    });
  }
  return Number(match[1]);
}

// @IfMatch() revision: number
export const IfMatch = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number =>
    parseIfMatch(
      context.switchToHttp().getRequest<Request>().header('if-match'),
    ),
);

export const etagOf = (revision: number) => `"${revision}"`;
