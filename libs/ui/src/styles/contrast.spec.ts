import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Spec 004 acceptance: every text colour meets WCAG AA (4.5:1) on the background
// it is used on, in both themes. Computed from tokens.css, so changing a colour
// that breaks contrast fails the build.

const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

const light = block(':root');
const dark = { ...light, ...block("[data-theme='dark']") };

function resolve(tokens: Record<string, string>, name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`token --${name} not found`);
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  return alias ? resolve(tokens, alias[1]) : value;
}

// OKLCH -> linear sRGB (Björn Ottosson's OKLab matrices) -> relative luminance.
function luminance(oklch: string): number {
  const m = oklch.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/);
  if (!m) throw new Error(`not an opaque oklch() colour: ${oklch}`);
  const [L, C, H] = m.slice(1).map(Number);
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const r = clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const g = clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const bl = clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(
  tokens: Record<string, string>,
  fg: string,
  bg: string,
): number {
  const [x, y] = [
    luminance(resolve(tokens, fg)),
    luminance(resolve(tokens, bg)),
  ];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// [text, background] pairs the components actually use.
const textPairs: Array<[string, string]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['primary', 'background'], // link button
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'card'], // error alert and field error text
  ['destructive', 'background'],
  ['success-foreground', 'success'],
  ['warning-foreground', 'warning'],
  ['approve-foreground', 'approve'],
  ['reject-foreground', 'reject'],
  ['refer-foreground', 'refer'],
];

// Icons and focus rings are not text: WCAG asks 3:1 for those.
const uiPairs: Array<[string, string]> = [
  ['ring', 'background'],
  ['success', 'card'],
  ['warning', 'card'],
  ['primary', 'card'],
];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s theme contrast', (_name, tokens) => {
  it.each(textPairs)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(tokens, fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(uiPairs)('%s on %s is at least 3:1', (fg, bg) => {
    expect(contrast(tokens, fg, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('luminance()', () => {
  it('matches the known values for white and black', () => {
    expect(luminance('oklch(1 0 0)')).toBeCloseTo(1, 3);
    expect(luminance('oklch(0 0 0)')).toBeCloseTo(0, 3);
  });
});
