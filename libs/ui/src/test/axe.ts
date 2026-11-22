import axe from 'axe-core';

// Runs axe-core on a rendered container and returns the violations, so a test
// failure lists the rule ids ("label", "button-name", ...) instead of a count.
// Colour contrast is off here: jsdom computes no styles, so it can't be judged.
// src/styles/contrast.spec.ts checks contrast from the tokens instead.
// "region" (all content inside landmarks) is a whole-page rule; a component on
// its own is not a page. The AppShell test checks the landmarks.
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}
