import type { Role, RulesetContent } from '@rule-studio/shared-types';
import { zRuleset, zRulesetPage } from '@rule-studio/shared-types';
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

// Spec 003: reading, creating and editing rulesets, against a real Postgres.
describe('Rulesets API (HTTP)', () => {
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

  async function create(name = 'Loan approval', role: Role = 'EDITOR') {
    const res = await api()
      .post('/api/rulesets')
      .set(auth(role))
      .send({ name });
    expect(res.status).toBe(201);
    return res;
  }

  describe('permissions', () => {
    it('lets a viewer read everything', async () => {
      const { body } = await create();
      for (const path of [
        '/api/rulesets',
        `/api/rulesets/${body.id}`,
        `/api/rulesets/${body.id}/versions`,
      ]) {
        expect((await api().get(path).set(auth('VIEWER'))).status).toBe(200);
      }
    });

    it('answers 403 to a viewer on every change, and to an editor on pin and archive', async () => {
      const { body } = await create();
      const base = `/api/rulesets/${body.id}`;
      const changes: Array<[string, string, Role[]]> = [
        ['post', '/api/rulesets', ['VIEWER']],
        ['patch', base, ['VIEWER']],
        ['put', `${base}/draft`, ['VIEWER']],
        ['post', `${base}/versions`, ['VIEWER']],
        ['post', `${base}/versions/1/restore`, ['VIEWER']],
        ['put', `${base}/live`, ['VIEWER', 'EDITOR']],
        ['post', `${base}/archive`, ['VIEWER', 'EDITOR']],
        ['post', `${base}/unarchive`, ['VIEWER', 'EDITOR']],
      ];
      for (const [method, path, forbidden] of changes) {
        for (const role of forbidden) {
          const res = await (
            api() as unknown as Record<string, (p: string) => request.Test>
          )
            [method](path)
            .set(auth(role))
            .set('If-Match', '"1"')
            .send({});
          expect({ method, path, role, status: res.status }).toEqual({
            method,
            path,
            role,
            status: 403,
          });
        }
      }
    });

    it('answers 401 without a token', async () => {
      expect((await api().get('/api/rulesets')).status).toBe(401);
    });
  });

  describe('create and read', () => {
    it('creates a ruleset with a valid starter draft and nothing published', async () => {
      const res = await create('Loan approval');
      expect(res.headers['location']).toBe(`/api/rulesets/${res.body.id}`);
      expect(res.headers['etag']).toBe('"1"');
      expect(zRuleset.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        name: 'Loan approval',
        revision: 1,
        hasUnpublishedChanges: true,
        latestVersion: null,
        liveVersion: null,
        archivedAt: null,
        createdBy: { displayName: 'Test editor' },
        validation: { valid: true, problems: [] },
        draft: {
          schemaVersion: 1,
          inputFields: [{ key: 'amount', type: 'NUMBER' }],
          rules: [],
        },
      });
    });

    it('keeps names unique ignoring case', async () => {
      await create('Loan approval');
      const res = await api()
        .post('/api/rulesets')
        .set(auth('EDITOR'))
        .send({ name: 'LOAN APPROVAL' });
      expect(res.status).toBe(409);
      expect(res.body.detail).toMatch(/already exists/);
    });

    it('rejects a missing or too long name', async () => {
      expect(
        (await api().post('/api/rulesets').set(auth('EDITOR')).send({})).status,
      ).toBe(400);
      expect(
        (
          await api()
            .post('/api/rulesets')
            .set(auth('EDITOR'))
            .send({ name: 'x'.repeat(101) })
        ).status,
      ).toBe(400);
    });

    it('answers 404 for an unknown id and 400 for a malformed one', async () => {
      expect(
        (
          await api()
            .get('/api/rulesets/7f1c4f8e-9d0a-4b1e-8c2d-3e4f5a6b7c8d')
            .set(auth('VIEWER'))
        ).status,
      ).toBe(404);
      expect(
        (await api().get('/api/rulesets/not-a-uuid').set(auth('VIEWER')))
          .status,
      ).toBe(400);
    });

    it('sends the ETag on reads', async () => {
      const { body } = await create();
      const res = await api()
        .get(`/api/rulesets/${body.id}`)
        .set(auth('VIEWER'));
      expect(res.headers['etag']).toBe('"1"');
    });
  });

  describe('list', () => {
    it('pages through rulesets, most recently changed first', async () => {
      for (const name of ['A', 'B', 'C']) await create(name);
      const first = await api()
        .get('/api/rulesets?pageSize=2')
        .set(auth('VIEWER'));
      expect(zRulesetPage.safeParse(first.body).success).toBe(true);
      expect(first.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(first.body.items.map((r: { name: string }) => r.name)).toEqual([
        'C',
        'B',
      ]);
      const second = await api()
        .get('/api/rulesets?pageSize=2&page=2')
        .set(auth('VIEWER'));
      expect(second.body.items.map((r: { name: string }) => r.name)).toEqual([
        'A',
      ]);
      expect(first.body.items[0]).not.toHaveProperty('draft');
    });

    it('filters by name, ignoring case', async () => {
      await create('Loan approval');
      await create('Card limits');
      const res = await api().get('/api/rulesets?q=LOAN').set(auth('VIEWER'));
      expect(res.body.items.map((r: { name: string }) => r.name)).toEqual([
        'Loan approval',
      ]);
    });

    it('rejects a page size over 100', async () => {
      expect(
        (await api().get('/api/rulesets?pageSize=101').set(auth('VIEWER')))
          .status,
      ).toBe(400);
    });
  });

  describe('optimistic locking', () => {
    it('answers 428 to a change without If-Match, and 400 to a malformed one', async () => {
      const { body } = await create();
      const noHeader = await api()
        .patch(`/api/rulesets/${body.id}`)
        .set(auth('EDITOR'))
        .send({ name: 'X' });
      expect(noHeader.status).toBe(428);
      const malformed = await api()
        .patch(`/api/rulesets/${body.id}`)
        .set(auth('EDITOR'))
        .set('If-Match', '1')
        .send({ name: 'X' });
      expect(malformed.status).toBe(400);
    });

    it('accepts the first of two saves based on the same revision and refuses the second with 412', async () => {
      const { body } = await create();
      const content = loanApprovalContent();
      const first = await api()
        .put(`/api/rulesets/${body.id}/draft`)
        .set(auth('EDITOR'))
        .set('If-Match', '"1"')
        .send(content);
      expect(first.status).toBe(200);
      expect(first.headers['etag']).toBe('"2"');

      const second = await api()
        .put(`/api/rulesets/${body.id}/draft`)
        .set(auth('ADMIN'))
        .set('If-Match', '"1"')
        .send({ ...content, hitStrategy: 'PRIORITY' });
      expect(second.status).toBe(412);
      expect(second.body).toMatchObject({ status: 412, currentRevision: 2 });

      const now = await api()
        .get(`/api/rulesets/${body.id}`)
        .set(auth('VIEWER'));
      expect(now.body.draft.hitStrategy).toBe('FIRST'); // the first save survived
    });

    it('lets exactly one of two simultaneous saves win', async () => {
      const { body } = await create();
      const save = (strategy: 'FIRST' | 'PRIORITY') =>
        api()
          .put(`/api/rulesets/${body.id}/draft`)
          .set(auth('EDITOR'))
          .set('If-Match', '"1"')
          .send({ ...loanApprovalContent(), hitStrategy: strategy });
      const statuses = (await Promise.all([save('FIRST'), save('PRIORITY')]))
        .map((r) => r.status)
        .sort();
      expect(statuses).toEqual([200, 412]);
    });
  });

  describe('identity', () => {
    it('renames and clears the description, bumping the revision', async () => {
      const { body } = await create();
      const res = await api()
        .patch(`/api/rulesets/${body.id}`)
        .set(auth('EDITOR'))
        .set('If-Match', '"1"')
        .send({ name: 'Personal loans', description: '' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Personal loans', revision: 2 });
      expect(res.body).not.toHaveProperty('description');
    });

    it('refuses a rename to a name taken in another case', async () => {
      await create('Card limits');
      const { body } = await create('Loan approval');
      const res = await api()
        .patch(`/api/rulesets/${body.id}`)
        .set(auth('EDITOR'))
        .set('If-Match', '"1"')
        .send({ name: 'card LIMITS' });
      expect(res.status).toBe(409);
    });

    it('rejects an empty patch', async () => {
      const { body } = await create();
      expect(
        (
          await api()
            .patch(`/api/rulesets/${body.id}`)
            .set(auth('EDITOR'))
            .set('If-Match', '"1"')
            .send({})
        ).status,
      ).toBe(400);
    });
  });

  describe('saving the draft', () => {
    async function save(id: string, content: unknown, revision = 1) {
      return api()
        .put(`/api/rulesets/${id}/draft`)
        .set(auth('EDITOR'))
        .set('If-Match', `"${revision}"`)
        .send(content as object);
    }

    it('saves a valid draft', async () => {
      const { body } = await create();
      const res = await save(body.id, loanApprovalContent());
      expect(res.status).toBe(200);
      expect(res.body.validation).toEqual({ valid: true, problems: [] });
      expect(res.body.draft.rules).toHaveLength(
        loanApprovalContent().rules.length,
      );
    });

    // The known-bad cases from spec 001 fail the contract's schema: 400, nothing saved.
    const structureBreaks: Array<[string, (c: RulesetContent) => unknown]> = [
      [
        'an unknown operator',
        (c) =>
          ((c.rules[0].when.children[0] as { operator: string }).operator =
            'ROUGHLY'),
      ],
      [
        'schemaVersion 2',
        (c) => ((c as { schemaVersion: number }).schemaVersion = 2),
      ],
      [
        'a bare-string defaultAction',
        (c) =>
          ((c as unknown as { defaultAction: string }).defaultAction =
            'APPROVE'),
      ],
      ['no input fields', (c) => (c.inputFields = [])],
      [
        '4 levels of nesting',
        (c) =>
          (c.rules[0].when.children = [
            {
              type: 'group',
              operator: 'AND',
              children: [
                {
                  type: 'group',
                  operator: 'AND',
                  children: [
                    {
                      type: 'group',
                      operator: 'AND',
                      children: [
                        {
                          type: 'condition',
                          field: 'hasDefaulted',
                          operator: 'IS_EMPTY',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ] as never),
      ],
    ];
    it.each(structureBreaks)(
      'refuses a draft with %s (400) and keeps the old one',
      async (_name, breakIt) => {
        const { body } = await create();
        const content = loanApprovalContent();
        breakIt(content);
        const res = await save(body.id, content);
        expect(res.status).toBe(400);
        expect(res.body.errors.length).toBeGreaterThan(0);
        const now = await api()
          .get(`/api/rulesets/${body.id}`)
          .set(auth('VIEWER'));
        expect(now.body.revision).toBe(1);
      },
    );

    it('saves a draft with cross-field problems and returns them', async () => {
      const { body } = await create();
      const content = loanApprovalContent();
      (content.rules[0].when.children[0] as { field: string }).field = 'income';
      const res = await save(body.id, content);
      expect(res.status).toBe(200);
      expect(res.body.validation).toEqual({
        valid: false,
        problems: [
          {
            path: '/rules/0/when/children/0/field',
            message: 'There is no input field "income".',
          },
        ],
      });
    });
  });

  describe('archive', () => {
    it('makes a ruleset read-only and hides it from the default list', async () => {
      const { body } = await create();
      const archived = await api()
        .post(`/api/rulesets/${body.id}/archive`)
        .set(auth('ADMIN'))
        .set('If-Match', '"1"');
      expect(archived.status).toBe(200);
      expect(archived.body.archivedAt).not.toBeNull();

      const save = await api()
        .put(`/api/rulesets/${body.id}/draft`)
        .set(auth('EDITOR'))
        .set('If-Match', '"2"')
        .send(loanApprovalContent());
      expect(save.status).toBe(409);
      const rename = await api()
        .patch(`/api/rulesets/${body.id}`)
        .set(auth('EDITOR'))
        .set('If-Match', '"2"')
        .send({ name: 'X' });
      expect(rename.status).toBe(409);

      expect(
        (await api().get('/api/rulesets').set(auth('VIEWER'))).body.total,
      ).toBe(0);
      const list = await api()
        .get('/api/rulesets?status=archived')
        .set(auth('VIEWER'));
      expect(list.body.items.map((r: { id: string }) => r.id)).toEqual([
        body.id,
      ]);
    });

    it('can be undone, and refuses to unarchive what is not archived', async () => {
      const { body } = await create();
      expect(
        (
          await api()
            .post(`/api/rulesets/${body.id}/unarchive`)
            .set(auth('ADMIN'))
            .set('If-Match', '"1"')
        ).status,
      ).toBe(409);
      await api()
        .post(`/api/rulesets/${body.id}/archive`)
        .set(auth('ADMIN'))
        .set('If-Match', '"1"');
      const back = await api()
        .post(`/api/rulesets/${body.id}/unarchive`)
        .set(auth('ADMIN'))
        .set('If-Match', '"2"');
      expect(back.status).toBe(200);
      expect(back.body).toMatchObject({ archivedAt: null, revision: 3 });
      expect(
        (
          await api()
            .put(`/api/rulesets/${body.id}/draft`)
            .set(auth('EDITOR'))
            .set('If-Match', '"3"')
            .send(loanApprovalContent())
        ).status,
      ).toBe(200);
    });
  });
});
