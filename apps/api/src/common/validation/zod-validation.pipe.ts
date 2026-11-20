import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodType } from 'zod';

export interface ValidationIssue {
  path: string;
  message: string;
}

// Validates a request part against a Zod schema generated from contracts/openapi.yaml:
//   @Body(new ZodValidationPipe(zLoginRequest)) body: LoginRequest
// On success it returns the parsed value (unknown keys stripped).
// On failure it throws a 400, which the problem-details filter turns into the API's error shape.
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    const errors: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    throw new BadRequestException({
      detail: 'The request is invalid.',
      errors,
    });
  }
}
