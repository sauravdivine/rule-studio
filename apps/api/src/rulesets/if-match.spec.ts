import { HttpException } from '@nestjs/common';
import { parseIfMatch } from './if-match';

function statusOf(header: string | undefined): number | undefined {
  try {
    parseIfMatch(header);
    return undefined;
  } catch (error) {
    return (error as HttpException).getStatus();
  }
}

describe('parseIfMatch', () => {
  it('reads the revision from a strong ETag', () => {
    expect(parseIfMatch('"14"')).toBe(14);
    expect(parseIfMatch(' "3" ')).toBe(3);
  });

  it('answers 428 when the header is missing', () => {
    expect(statusOf(undefined)).toBe(428);
    expect(statusOf('')).toBe(428);
  });

  it.each(['14', 'W/"14"', '"abc"', '*', '"1", "2"'])(
    'answers 400 for %s',
    (header) => {
      expect(statusOf(header)).toBe(400);
    },
  );
});
