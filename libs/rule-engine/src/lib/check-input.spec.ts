import { loanApproval } from '../test/fixtures.js';
import { checkInput } from './check-input.js';

const fields = loanApproval().inputFields;

describe('checkInput', () => {
  it('accepts a correct record, a partial one, and extra keys', () => {
    expect(
      checkInput(fields, {
        creditScore: 700,
        annualIncome: 0,
        employmentType: 'SALARIED',
        hasDefaulted: false,
        dateOfBirth: '1990-05-01',
        somethingElse: 'ignored',
      }),
    ).toEqual([]);
    expect(checkInput(fields, {})).toEqual([]);
    expect(
      checkInput(fields, { creditScore: null, employmentType: '' }),
    ).toEqual([]);
  });

  it('refuses every value of the wrong type, with its path', () => {
    expect(
      checkInput(fields, {
        creditScore: '700',
        hasDefaulted: 'yes',
        dateOfBirth: '2026-02-30',
        annualIncome: Number.NaN,
      }),
    ).toEqual([
      {
        path: '/creditScore',
        message: '"Credit score" needs a number, not "700".',
      },
      {
        path: '/annualIncome',
        message: '"Annual income (₹)" needs a number, not NaN.',
      },
      {
        path: '/hasDefaulted',
        message: '"Previous default" needs true or false, not "yes".',
      },
      {
        path: '/dateOfBirth',
        message: '"Date of birth" needs a date (YYYY-MM-DD), not "2026-02-30".',
      },
    ]);
  });

  it('refuses a text value outside the allowed values', () => {
    expect(checkInput(fields, { employmentType: 'salaried' })).toEqual([
      {
        path: '/employmentType',
        message:
          '"salaried" isn\'t an allowed value for "Employment type" (SALARIED, SELF_EMPLOYED, UNEMPLOYED, STUDENT).',
      },
    ]);
  });
});
