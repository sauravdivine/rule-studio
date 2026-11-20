import { BadRequestException } from '@nestjs/common';
import { zLoginRequest } from '@rule-studio/shared-types';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(zLoginRequest);

  it('returns the parsed value when it is valid', () => {
    expect(
      pipe.transform({ email: 'viewer@rulestudio.dev', password: 'secret' }),
    ).toEqual({ email: 'viewer@rulestudio.dev', password: 'secret' });
  });

  it('strips keys the contract does not define', () => {
    expect(
      pipe.transform({ email: 'a@b.dev', password: 'x', isAdmin: true }),
    ).toEqual({ email: 'a@b.dev', password: 'x' });
  });

  it('throws a 400 listing each invalid field', () => {
    try {
      pipe.transform({ email: 'not-an-email', password: '' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        errors: { path: string }[];
      };
      expect(body.errors.map((issue) => issue.path).sort()).toEqual([
        'email',
        'password',
      ]);
    }
  });

  it('rejects a missing body', () => {
    expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
  });
});
