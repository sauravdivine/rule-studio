import type { Role } from '@rule-studio/shared-types';
import { zEvaluationResult } from '@rule-studio/shared-types';
import request from 'supertest';
import { loanApprovalContent } from '../test/rulesets-fixtures';
import {
  createTestApp,
  createUser,
  resetDatabase,
  resetRulesets,
  TEST_PASSWORD,
  type TestApp,
} from '../test/test-app';

// Spec 006: POST /api/rulesets/:id/evaluate against a real Postgres.
describe('Evaluate API (HTTP)', () => {
  let t: TestApp;
  const tokens = {} as Record<Role, string>;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.prisma);
    for (const role of ['VIEWER', 'EDITOR', 'ADMIN'] as const) {
      await createUser(t.prisma, role);
      const res = await request(t.server)
        .post('/api/auth/login')
        .send({
          email: `${role.toLowerCase()}@rulestudio.test`,
          password: TEST_PASSWORD,
        });
      tokens[role] = res.body.accessToken;
    }
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetRulesets(t.prisma);
  });

  const auth = (role: Role) => ({ Authorization: `Bearer ${tokens[role]}` });
  const api = () => request(t.server);
  const strongApplicant = {
    creditScore: 780,
    employmentType: 'SALARIED',
    debtToIncome: 20,
  };

  // A ruleset with the example as v1 (live), then a draft where the approve rule
  // is disabled, so live and draft answer differently.
  async function seeded() {
    const created = await api()
      .post('/api/rulesets')
      .set(auth('EDITOR'))
      .send({ name: 'Loans' });
    const id: string = created.body.id;
    const v1 = await api()
      .put(`/api/rulesets/${id}/draft`)
      .set(auth('EDITOR'))
      .set('If-Match', '"1"')
      .send(loanApprovalContent());
    await api()
      .post(`/api/rulesets/${id}/versions`)
      .set(auth('EDITOR'))
      .set('If-Match', v1.headers['etag'])
      .send({});
    const draft = loanApprovalContent();
    draft.rules[3].enabled = false;
    await api()
      .put(`/api/rulesets/${id}/draft`)
      .set(auth('EDITOR'))
      .set('If-Match', '"3"')
      .send(draft);
    return id;
  }
  const run = (id: string, body: object, role: Role = 'VIEWER') =>
    api().post(`/api/rulesets/${id}/evaluate`).set(auth(role)).send(body);

  it('evaluates the live version by default, for any signed-in role', async () => {
    const id = await seeded();
    for (const role of ['VIEWER', 'EDITOR', 'ADMIN'] as const) {
      const res = await run(id, { input: strongApplicant }, role);
      expect(res.status).toBe(200);
      expect(zEvaluationResult.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        version: 1,
        output: { decision: 'APPROVE' },
      });
      expect(res.body.firedRules).toHaveLength(1);
      expect(res.body).not.toHaveProperty('trace');
    }
  });

  it('evaluates the draft, or a version by number', async () => {
    const id = await seeded();
    expect(
      (await run(id, { target: 'draft', input: strongApplicant })).body,
    ).toMatchObject({
      version: 'draft',
      output: { decision: 'REFER' }, // the approve rule is disabled in the draft
      firedRules: [],
    });
    expect(
      (await run(id, { target: 1, input: strongApplicant })).body,
    ).toMatchObject({ version: 1, output: { decision: 'APPROVE' } });
  });

  it('includes the trace only with explain', async () => {
    const id = await seeded();
    const res = await run(id, { input: { hasDefaulted: true }, explain: true });
    expect(res.body.trace.map((r: { status: string }) => r.status)).toEqual([
      'fired',
      'notReached',
      'notReached',
      'notReached',
    ]);
    expect(res.body.trace[0].when.children[0]).toMatchObject({
      field: 'hasDefaulted',
      actual: true,
      result: true,
    });
  });

  it('answers 409 when nothing is live yet', async () => {
    const created = await api()
      .post('/api/rulesets')
      .set(auth('EDITOR'))
      .send({ name: 'New' });
    const res = await run(created.body.id, { input: {} });
    expect(res.status).toBe(409);
    expect(res.body.detail).toMatch(/Nothing is live yet/);
  });

  it('answers 404 for an unknown ruleset or version', async () => {
    const id = await seeded();
    expect((await run(id, { target: 7, input: {} })).status).toBe(404);
    expect(
      (await run('7f1c4f8e-9d0a-4b1e-8c2d-3e4f5a6b7c8d', { input: {} })).status,
    ).toBe(404);
  });

  it('answers 422 for a draft with problems', async () => {
    const id = await seeded();
    const broken = loanApprovalContent();
    (broken.rules[0].when.children[0] as { field: string }).field = 'income';
    await api()
      .put(`/api/rulesets/${id}/draft`)
      .set(auth('EDITOR'))
      .set('If-Match', '"4"')
      .send(broken);
    const res = await run(id, { target: 'draft', input: {} });
    expect(res.status).toBe(422);
    expect(res.body.problems).toEqual([
      {
        path: '/rules/0/when/children/0/field',
        message: 'There is no input field "income".',
      },
    ]);
  });

  it('answers 400 listing every input problem, with paths into the request', async () => {
    const id = await seeded();
    const res = await run(id, {
      input: {
        creditScore: '780',
        hasDefaulted: 'no',
        employmentType: 'salaried',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual([
      '/input/creditScore',
      '/input/employmentType',
      '/input/hasDefaulted',
    ]);
  });

  it('ignores keys that are not input fields', async () => {
    const id = await seeded();
    expect(
      (await run(id, { input: { ...strongApplicant, customerId: 'C-42' } }))
        .body.output.decision,
    ).toBe('APPROVE');
  });

  it('rejects a malformed request (400) and needs a token (401)', async () => {
    const id = await seeded();
    expect((await run(id, { input: [] })).status).toBe(400);
    expect((await run(id, { target: 'latest', input: {} })).status).toBe(400);
    expect(
      (await api().post(`/api/rulesets/${id}/evaluate`).send({ input: {} }))
        .status,
    ).toBe(401);
  });
});
