import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '@rule-studio/shared-types';
import { zRulesetContent } from '@rule-studio/shared-types';
import { createTestHost } from '@rule-studio/host/testing';
import { App } from './App';
import { createFakeRulesetsApi } from './test/fake-rulesets-api';
import { loanApproval } from './test/fixtures';

// Spec 005 screen tests: the rule editor mounted as the shell mounts it
// (under /rulesets/*, in a data router), against an in-memory fake of the
// spec 003 API.

type Fake = ReturnType<typeof createFakeRulesetsApi>;

function setup({
  role = 'EDITOR',
  path = '/rulesets',
  seed,
}: { role?: Role; path?: string; seed?: (fake: Fake) => void } = {}) {
  const fake = createFakeRulesetsApi(role);
  seed?.(fake);
  const host = createTestHost(role, { api: fake.api });
  const router = createMemoryRouter(
    [
      { path: '/rulesets/*', element: <App host={host} /> },
      { path: '/simulator', element: <h1>Simulator page</h1> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return { fake, router, user: userEvent.setup() };
}

const loans = (fake: Fake, versions = 2) =>
  fake.add('Personal loans', loanApproval(), { versions });

async function openRuleset(options: Parameters<typeof setup>[0] = {}) {
  let id = '';
  const result = setup({
    ...options,
    path: '/rulesets/ruleset-1',
    seed: (fake) => {
      id = loans(fake).id;
      options.seed?.(fake);
    },
  });
  await screen.findByRole('heading', { level: 1, name: 'Personal loans' });
  return { ...result, id };
}

async function expandRule(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) {
  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`Expand rule ${name.source}`),
    }),
  );
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  combobox: HTMLElement,
  option: string,
) {
  await user.click(combobox);
  await user.click(await screen.findByRole('option', { name: option }));
}

async function noAxeViolations() {
  const results = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(
    results.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}

const value = (name: string) => screen.getByRole('spinbutton', { name });

// Sonner renders a toast's text more than once (one copy is for screen
// readers), so wait for any copy.
const toastShown = async (text: string | RegExp) =>
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);

describe('ruleset list', () => {
  it('shows each ruleset with its live and latest version and unpublished changes', async () => {
    setup({
      seed: (fake) => {
        loans(fake);
        const card = fake.add('Card limits', loanApproval(), { versions: 1 });
        fake.changeBehindYourBack(card.id);
        fake.add('Overdrafts');
      },
    });
    const rows = await screen.findAllByRole('row');
    const text = rows.slice(1).map((r) => r.textContent);
    expect(text[0]).toMatch(/Overdrafts.*—.*Draft only/);
    expect(text[1]).toMatch(/Card limits.*Unpublished changes.*v1.*v1/);
    expect(text[2]).toMatch(/Personal loans.*v1.*v2/);
    expect(text[2]).not.toMatch(/Unpublished/);
    await noAxeViolations();
  });

  it('searches by name after a pause, and keeps the search in the URL', async () => {
    const { user, router } = setup({
      seed: (fake) => [loans(fake), fake.add('Card limits')],
    });
    await screen.findByRole('link', { name: 'Card limits' });
    await user.type(
      screen.getByRole('searchbox', { name: 'Search rulesets by name' }),
      'card',
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'Personal loans' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('link', { name: 'Card limits' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=card');
  });

  it('shows archived rulesets only on the Archived tab', async () => {
    const { user } = setup({
      seed: (fake) => [
        loans(fake),
        fake.add('Old rules', loanApproval(), { archived: true }),
      ],
    });
    await screen.findByRole('link', { name: 'Personal loans' });
    expect(
      screen.queryByRole('link', { name: 'Old rules' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Archived' }));
    expect(
      await screen.findByRole('link', { name: 'Old rules' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Personal loans' }),
    ).not.toBeInTheDocument();
  });

  it('pages through rulesets', async () => {
    const { user, router } = setup({
      seed: (fake) =>
        Array.from({ length: 12 }, (_, i) => fake.add(`Ruleset ${i + 1}`)),
    });
    await screen.findByText('Page 1 of 2 · 12 rulesets');
    expect(screen.getAllByRole('row')).toHaveLength(11);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2 · 12 rulesets');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(router.state.location.search).toBe('?page=2');
  });

  it('shows loading, then an error with a working retry', async () => {
    let release = () => undefined as void;
    const { user } = setup({
      seed: (fake) => {
        loans(fake);
        release = fake.hold();
        fake.failNext(500, 'Database is down');
      },
    });
    expect(screen.getByLabelText('Loading rulesets')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('link', { name: 'Personal loans' }),
    ).toBeInTheDocument();
  });

  it('shows an empty state, with a create action only for editors', async () => {
    setup({ role: 'VIEWER' });
    expect(
      await screen.findByRole('heading', { name: 'No rulesets yet' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'New ruleset' }),
    ).not.toBeInTheDocument();
  });

  it('creates a ruleset and opens it in the editor', async () => {
    const { user, router } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'New ruleset' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'New ruleset' });
    await user.type(within(dialog).getByLabelText('Name'), 'Card limits');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Card limits' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/rulesets/ruleset-1');
    expect(screen.getByText('Not published')).toBeInTheDocument();
  });

  it('shows "name taken" on the field', async () => {
    const { user } = setup({ seed: (fake) => loans(fake) });
    await user.click(
      await screen.findByRole('button', { name: 'New ruleset' }),
    );
    await user.type(screen.getByLabelText('Name'), 'PERSONAL LOANS');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText(
        'A ruleset named "PERSONAL LOANS" already exists.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});

describe('editing a draft', () => {
  it('edits fields, strategy, default action and a 3-level condition, and saves a valid draft', async () => {
    const { user, fake, id } = await openRuleset();
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await user.clear(
      screen.getByRole('textbox', {
        name: `Label, field ${loanApproval().inputFields.length + 1}`,
      }),
    );
    await user.type(
      screen.getByRole('textbox', {
        name: `Label, field ${loanApproval().inputFields.length + 1}`,
      }),
      'Loan amount',
    );
    await choose(
      user,
      screen.getByRole('combobox', { name: 'Hit strategy' }),
      'Strictest decision',
    );
    await user.clear(screen.getByRole('textbox', { name: 'Default reason' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Default reason' }),
      'Review by hand',
    );

    await expandRule(user, /Reject low score/);
    await user.click(
      screen.getByRole('button', { name: 'Add group to group 1.2, rule #2' }),
    );
    expect(
      screen.getByRole('group', { name: 'Group 1.2.3, rule #2' }),
    ).toBeInTheDocument();
    // Level 3 is as deep as groups go.
    expect(
      screen.queryByRole('button', {
        name: 'Add group to group 1.2.3, rule #2',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await toastShown('Draft saved');
    const saved = fake.draftOf(id);
    expect(zRulesetContent.safeParse(saved).success).toBe(true);
    expect(saved).toMatchObject({
      hitStrategy: 'PRIORITY',
      defaultAction: { reason: 'Review by hand' },
    });
    expect(saved.inputFields.at(-1)).toMatchObject({ label: 'Loan amount' });
    expect(JSON.stringify(saved.rules[1].when)).toMatch(
      /"type":"group".*"type":"group".*"type":"group"/,
    );
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
  });

  it('only offers operators the field type allows, and a value input that matches the type', async () => {
    const { user } = await openRuleset();
    await expandRule(user, /Reject previous defaulters/);
    const field = screen.getByRole('combobox', {
      name: 'Field, condition 1 in group 1, rule #1',
    });
    const operator = () =>
      screen.getByRole('combobox', {
        name: 'Operator, condition 1 in group 1, rule #1',
      });

    // A true/false field
    await user.click(operator());
    expect(
      (await screen.findAllByRole('option')).map((o) => o.textContent),
    ).toEqual(['is', 'is not', 'is empty', 'is not empty']);
    await user.keyboard('{Escape}');

    await choose(user, field, 'Credit score');
    expect(value('Value, condition 1 in group 1, rule #1')).toBeInTheDocument();
    await user.click(operator());
    expect(
      (await screen.findAllByRole('option')).map((o) => o.textContent),
    ).toContain('is between');
    await user.click(screen.getByRole('option', { name: 'is between' }));
    expect(
      value('From value, condition 1 in group 1, rule #1'),
    ).toBeInTheDocument();
    expect(
      value('To value, condition 1 in group 1, rule #1'),
    ).toBeInTheDocument();

    await choose(user, field, 'Employment type');
    expect(
      screen.getByRole('combobox', {
        name: 'Value, condition 1 in group 1, rule #1',
      }),
    ).toBeInTheDocument();

    await choose(user, field, 'Date of birth');
    expect(
      screen.getByLabelText('Value, condition 1 in group 1, rule #1'),
    ).toHaveAttribute('type', 'date');
  });

  it('shows problems inline and in the panel while editing, before saving', async () => {
    const { user, fake } = await openRuleset();
    expect(screen.getByText('None. Ready to publish.')).toBeInTheDocument();
    await expandRule(user, /Reject low score/);
    await user.clear(value('Value, condition 1 in group 1, rule #2'));

    const input = value('Value, condition 1 in group 1, rule #2');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a value.');
    const panel = screen.getByRole('complementary', { name: 'Problems' });
    expect(
      within(panel).getByRole('button', {
        name: /Enter a value\. Rule 2, condition 1/,
      }),
    ).toBeInTheDocument();
    // A structure problem blocks Save, and says so.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(
      screen.getByText('Fix 1 problem(s) before saving.'),
    ).toBeInTheDocument();
    expect(fake.calls.filter((c) => c.startsWith('PUT'))).toEqual([]);
  });

  it('lets you save a draft with cross-field problems, but not publish it', async () => {
    const { user } = await openRuleset();
    await expandRule(user, /Reject low score/);
    await choose(
      user,
      screen.getByRole('combobox', {
        name: 'Operator, condition 1 in group 1, rule #2',
      }),
      'is between',
    );
    await user.clear(value('From value, condition 1 in group 1, rule #2'));
    await user.type(
      value('From value, condition 1 in group 1, rule #2'),
      '700',
    );
    await user.clear(value('To value, condition 1 in group 1, rule #2'));
    await user.type(value('To value, condition 1 in group 1, rule #2'), '600');

    expect(
      within(screen.getByRole('complementary', { name: 'Problems' })).getByText(
        'The first value (700) is bigger than the second (600).',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await toastShown('Draft saved');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(
      screen.getByText('Fix 1 problem(s) before publishing.'),
    ).toBeInTheDocument();
  });

  it('moves focus to a problem when it is clicked in the panel', async () => {
    const { user } = await openRuleset();
    await expandRule(user, /Reject low score/);
    await user.clear(value('Value, condition 1 in group 1, rule #2'));
    await user.click(
      screen.getByRole('button', { name: /Collapse rule Reject low score/ }),
    );
    await user.click(
      within(screen.getByRole('complementary', { name: 'Problems' })).getByRole(
        'button',
        { name: /Enter a value/ },
      ),
    );
    await waitFor(() =>
      expect(value('Value, condition 1 in group 1, rule #2')).toHaveFocus(),
    );
  });

  it('shows the conflict dialog on 412 and overwrites nothing', async () => {
    const { user, fake, id } = await openRuleset();
    fake.changeBehindYourBack(id);
    await user.clear(screen.getByRole('textbox', { name: 'Default reason' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Default reason' }),
      'Mine',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Someone else changed this ruleset',
    });
    expect(fake.draftOf(id).defaultAction.reason).toBe(
      'Changed by someone else',
    );
    await user.click(
      within(dialog).getByRole('button', { name: /Load their version/ }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Default reason' }),
      ).toHaveValue('Changed by someone else'),
    );
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
  });

  it('asks before leaving with unsaved changes', async () => {
    const { user, router } = await openRuleset();
    await user.type(
      screen.getByRole('textbox', { name: 'Default reason' }),
      '!',
    );
    await user.click(screen.getByRole('link', { name: 'Rulesets' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Leave without saving?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(router.state.location.pathname).toBe('/rulesets/ruleset-1');

    await user.click(screen.getByRole('link', { name: 'Rulesets' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Leave',
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Rulesets' }),
    ).toBeInTheDocument();
  });

  it('can be used with the keyboard alone', async () => {
    const { user } = await openRuleset();
    screen
      .getByRole('button', { name: /Expand rule Reject previous defaulters/ })
      .focus();
    await user.keyboard('{Enter}');
    // Tab through the rule to "Add condition", press Enter.
    const addCondition = screen.getByRole('button', {
      name: 'Add condition to group 1, rule #1',
    });
    for (let i = 0; i < 40 && document.activeElement !== addCondition; i++)
      await user.tab();
    expect(addCondition).toHaveFocus();
    await user.keyboard('{Enter}');
    const newField = screen.getByRole('combobox', {
      name: 'Field, condition 2 in group 1, rule #1',
    });
    // Change the new condition's operator from the keyboard.
    const operator = screen.getByRole('combobox', {
      name: 'Operator, condition 2 in group 1, rule #1',
    });
    operator.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(operator).toHaveTextContent('is not');
    expect(newField).toBeInTheDocument();
  });

  it('has no accessibility violations with a rule open', async () => {
    const { user } = await openRuleset();
    await expandRule(user, /Reject low score/);
    await noAxeViolations();
  });
});

describe('publishing and history', () => {
  it('disables Publish with the reason, then publishes the next version', async () => {
    const { user, fake, id } = await openRuleset();
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    expect(
      screen.getByText('Nothing new to publish since version 2.'),
    ).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: 'Default reason' }),
      '!',
    );
    expect(
      screen.getByText('Save your changes before publishing.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await toastShown('Draft saved');
    await waitFor(() => expect(publish).toBeEnabled());

    await user.click(publish);
    const dialog = screen.getByRole('dialog', { name: 'Publish version 3' });
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument(); // editors can't make it live
    await noAxeViolations();
    await user.type(
      within(dialog).getByLabelText(/What changed/),
      'Tweak the reason',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Publish v3' }),
    );
    await toastShown('Published version 3');
    expect(fake.versionsOf(id)).toHaveLength(3);

    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(
      await screen.findByRole('cell', { name: 'Tweak the reason' }),
    ).toBeInTheDocument();
    await noAxeViolations();
  });

  it('restores an old version into the draft', async () => {
    const { user, fake, id } = await openRuleset({
      seed: (f) => {
        f.changeBehindYourBack('ruleset-1');
        // v3 differs from v1 and v2
      },
    });
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Restore version 1 into the draft',
      }),
    );
    expect(
      await screen.findByText('Version 1 restored into the draft'),
    ).toBeInTheDocument();
    expect(fake.draftOf(id)).toEqual(fake.versionsOf(id)[0].content);
    // Back on the Draft tab to see the restored content.
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  it('lets an admin make any version live; an editor never sees the option', async () => {
    const editor = await openRuleset();
    await editor.user.click(screen.getByRole('tab', { name: 'History' }));
    await screen.findByRole('button', { name: 'View version 1' });
    expect(
      screen.queryByRole('button', { name: /Make version/ }),
    ).not.toBeInTheDocument();
    document.body.innerHTML = '';

    const { user, fake, id } = await openRuleset({ role: 'ADMIN' });
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(
      await screen.findByRole('button', { name: 'Make version 2 live' }),
    );
    expect(
      await screen.findByText('Version 2 is now live'),
    ).toBeInTheDocument();
    expect(fake.stored(id).liveVersion).toBe(2);
    expect(screen.getByText('Live v2')).toBeInTheDocument();
  });

  it('shows the make-live option when an admin publishes', async () => {
    const { user } = await openRuleset({ role: 'ADMIN' });
    await user.type(
      screen.getByRole('textbox', { name: 'Default reason' }),
      '!',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await toastShown('Draft saved');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(
      await screen.findByRole('checkbox', { name: /Make this version live/ }),
    ).toBeInTheDocument();
  });

  it('opens a published version read-only', async () => {
    const { user } = await openRuleset();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await user.click(
      await screen.findByRole('button', { name: 'View version 1' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Version 1' });
    expect(
      await within(dialog).findByRole('heading', {
        name: 'Reject previous defaulters',
      }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('read-only', () => {
  it('shows a viewer no editing controls at all', async () => {
    await openRuleset({ role: 'VIEWER' });
    expect(
      screen.getByText('You can view this ruleset but not change it.'),
    ).toBeInTheDocument();
    for (const role of [
      'textbox',
      'spinbutton',
      'combobox',
      'switch',
    ] as const) {
      expect(screen.queryAllByRole(role)).toEqual([]);
    }
    expect(
      screen.queryByRole('button', { name: /Save|Publish|More actions|Add/ }),
    ).not.toBeInTheDocument();
    await noAxeViolations();
  });

  it('makes an archived ruleset read-only for editors too', async () => {
    setup({
      path: '/rulesets/ruleset-1',
      seed: (fake) => fake.add('Old rules', loanApproval(), { archived: true }),
    });
    expect(
      await screen.findByText('Archived rulesets can’t be changed.'),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toEqual([]);
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });

  it('says when a ruleset does not exist', async () => {
    setup({ path: '/rulesets/nope' });
    expect(
      await screen.findByRole('heading', { name: 'Ruleset not found' }),
    ).toBeInTheDocument();
  });
});
