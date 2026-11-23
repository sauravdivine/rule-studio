import type { Role } from '@rule-studio/shared-types';
import { zRulesetVersion } from '@rule-studio/shared-types';
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

// Spec 003: publishing, history, the live version and rollback, against a real Postgres.
describe('Ruleset versions API (HTTP)', () => {
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

  // A small driver that remembers the latest ETag, like an editor screen would.
  async function newRuleset() {
    const created = await api()
      .post('/api/rulesets')
      .set(auth('EDITOR'))
      .send({ name: 'Loan approval' });
    const id: string = created.body.id;
    let etag: string = created.headers['etag'];
    const track = (res: request.Response) => {
      if (res.headers['etag']) etag = res.headers['etag'];
      return res;
    };
    return {
      id,
      get etag() {
        return etag;
      },
      save: async (reason: string) => {
        const content = loanApprovalContent();
        content.defaultAction.reason = reason;
        return track(
          await api()
            .put(`/api/rulesets/${id}/draft`)
            .set(auth('EDITOR'))
            .set('If-Match', etag)
            .send(content),
        );
      },
      publish: async (body: object = {}) =>
        track(
          await api()
            .post(`/api/rulesets/${id}/versions`)
            .set(auth('EDITOR'))
            .set('If-Match', etag)
            .send(body),
        ),
      restore: async (version: number) =>
        track(
          await api()
            .post(`/api/rulesets/${id}/versions/${version}/restore`)
            .set(auth('EDITOR'))
            .set('If-Match', etag),
        ),
      get: () => api().get(`/api/rulesets/${id}`).set(auth('VIEWER')),
      versions: () =>
        api().get(`/api/rulesets/${id}/versions`).set(auth('VIEWER')),
      version: (n: number) =>
        api().get(`/api/rulesets/${id}/versions/${n}`).set(auth('VIEWER')),
      pin: (version: number, role: Role = 'ADMIN') =>
        api().put(`/api/rulesets/${id}/live`).set(auth(role)).send({ version }),
    };
  }

  describe('publish', () => {
    it('publishes v1 and makes it live', async () => {
      const r = await newRuleset();
      await r.save('one');
      const res = await r.publish({ comment: 'First release' });
      expect(res.status).toBe(201);
      expect(res.headers['location']).toBe(`/api/rulesets/${r.id}/versions/1`);
      expect(res.headers['etag']).toBe('"3"');
      expect(zRulesetVersion.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        version: 1,
        comment: 'First release',
        isLive: true,
        publishedBy: { displayName: 'Test editor' },
      });

      expect((await r.get()).body).toMatchObject({
        latestVersion: 1,
        liveVersion: 1,
        hasUnpublishedChanges: false,
        revision: 3,
      });
    });

    it('refuses to publish with no changes (409)', async () => {
      const r = await newRuleset();
      await r.save('one');
      await r.publish();
      const again = await r.publish();
      expect(again.status).toBe(409);
      expect(again.body.detail).toMatch(/same as version 1/);
    });

    it('treats a save that only reorders keys as no change', async () => {
      const r = await newRuleset();
      await r.save('one');
      await r.publish();
      const content = loanApprovalContent();
      content.defaultAction.reason = 'one';
      const reordered = Object.fromEntries(Object.entries(content).reverse());
      await api()
        .put(`/api/rulesets/${r.id}/draft`)
        .set(auth('EDITOR'))
        .set('If-Match', r.etag)
        .send(reordered);
      expect((await r.get()).body.hasUnpublishedChanges).toBe(false);
    });

    it('refuses to publish a draft with problems (422) and lists them', async () => {
      const r = await newRuleset();
      const content = loanApprovalContent();
      (content.rules[0].when.children[0] as { field: string }).field = 'income';
      const saved = await api()
        .put(`/api/rulesets/${r.id}/draft`)
        .set(auth('EDITOR'))
        .set('If-Match', r.etag)
        .send(content);
      const res = await api()
        .post(`/api/rulesets/${r.id}/versions`)
        .set(auth('EDITOR'))
        .set('If-Match', saved.headers['etag'])
        .send({});
      expect(res.status).toBe(422);
      expect(res.body.problems).toEqual([
        {
          path: '/rules/0/when/children/0/field',
          message: 'There is no input field "income".',
        },
      ]);
      expect((await r.versions()).body).toEqual([]);
    });

    it('moves the live version only when asked', async () => {
      const r = await newRuleset();
      await r.save('one');
      await r.publish();
      await r.save('two');
      expect((await r.publish()).body).toMatchObject({
        version: 2,
        isLive: false,
      });
      expect((await r.get()).body).toMatchObject({
        latestVersion: 2,
        liveVersion: 1,
      });
      await r.save('three');
      expect((await r.publish({ makeLive: true })).body).toMatchObject({
        version: 3,
        isLive: true,
      });
      expect((await r.get()).body.liveVersion).toBe(3);
    });

    it('needs If-Match (428) and refuses a stale one (412)', async () => {
      const r = await newRuleset();
      expect(
        (
          await api()
            .post(`/api/rulesets/${r.id}/versions`)
            .set(auth('EDITOR'))
            .send({})
        ).status,
      ).toBe(428);
      expect(
        (
          await api()
            .post(`/api/rulesets/${r.id}/versions`)
            .set(auth('EDITOR'))
            .set('If-Match', '"99"')
            .send({})
        ).status,
      ).toBe(412);
    });

    it('lets exactly one of two simultaneous publishes win', async () => {
      const r = await newRuleset();
      await r.save('one');
      const publish = () =>
        api()
          .post(`/api/rulesets/${r.id}/versions`)
          .set(auth('EDITOR'))
          .set('If-Match', r.etag)
          .send({});
      const statuses = (await Promise.all([publish(), publish()]))
        .map((res) => res.status)
        .sort();
      expect(statuses).toEqual([201, 412]);
      expect((await r.versions()).body).toHaveLength(1);
    });

    it('stores an empty comment as none, and rejects one over 500 characters', async () => {
      const r = await newRuleset();
      await r.save('one');
      expect((await r.publish({ comment: 'x'.repeat(501) })).status).toBe(400);
      expect((await r.publish({ comment: '' })).body.comment).toBeNull();
    });
  });

  it('sends no ETag on responses that are not a ruleset, such as errors', async () => {
    const r = await newRuleset();
    const res = await api()
      .post(`/api/rulesets/${r.id}/versions`)
      .set(auth('EDITOR'))
      .set('If-Match', r.etag)
      .send({ comment: 'x'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.headers['etag']).toBeUndefined();
  });

  describe('history', () => {
    it('lists versions newest first, marking the live one, and returns any version with its content', async () => {
      const r = await newRuleset();
      await r.save('one');
      await r.publish({ comment: 'v1' });
      await r.save('two');
      await r.publish({ comment: 'v2' });
      const list = await r.versions();
      expect(
        list.body.map((v: { version: number; isLive: boolean }) => [
          v.version,
          v.isLive,
        ]),
      ).toEqual([
        [2, false],
        [1, true],
      ]);
      expect(list.body[0]).not.toHaveProperty('content');
      expect((await r.version(1)).body.content.defaultAction.reason).toBe(
        'one',
      );
      expect((await r.version(3)).status).toBe(404);
    });

    it('never changes a published version', async () => {
      const r = await newRuleset();
      await r.save('one');
      await r.publish();
      const before = (await r.version(1)).body;

      await r.save('two');
      await r.publish({ makeLive: true });
      await r.restore(1);
      await r.save('three');
      await r.publish();
      await r.pin(1);

      const after = (await r.version(1)).body;
      expect({ ...after, isLive: undefined }).toEqual({
        ...before,
        isLive: undefined,
      });
    });
  });

  describe('rollback', () => {
    it("restores an old version into the draft; publishing it makes v3 with v1's hash", async () => {
      const r = await newRuleset();
      await r.save('one');
      const v1 = (await r.publish()).body;
      await r.save('two');
      await r.publish();

      const restored = await r.restore(1);
      expect(restored.status).toBe(200);
      expect(restored.body).toMatchObject({ hasUnpublishedChanges: true });
      expect(restored.body.draft.defaultAction.reason).toBe('one');

      const v3 = (await r.publish()).body;
      expect(v3.version).toBe(3);
      expect(v3.contentHash).toBe(v1.contentHash);
    });

    it('shows no unpublished changes after restoring the latest version', async () => {
      const r = await newRuleset();
      await r.save('one');
      await r.publish();
      await r.save('two');
      await r.restore(1);
      expect((await r.get()).body.hasUnpublishedChanges).toBe(false);
    });

    it('answers 404 for a version that does not exist', async () => {
      const r = await newRuleset();
      expect((await r.restore(1)).status).toBe(404);
    });
  });

  describe('live version', () => {
    it('lets an admin pin any published version, without changing the revision', async () => {
      const r = await newRuleset();
      await r.save('one');
      await r.publish();
      await r.save('two');
      await r.publish();
      const revision = (await r.get()).body.revision;
      const res = await r.pin(2);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ liveVersion: 2, revision });
      const list = (await r.versions()).body;
      expect(
        list.find((v: { version: number }) => v.version === 2).isLive,
      ).toBe(true);
    });

    it('refuses to pin before anything is published (409) or an unknown version (404)', async () => {
      const r = await newRuleset();
      expect((await r.pin(1)).status).toBe(409);
      await r.save('one');
      await r.publish();
      expect((await r.pin(5)).status).toBe(404);
    });

    it('keeps the live version when archived, and refuses pinning while archived', async () => {
      const r = await newRuleset();
      await r.save('one');
      await r.publish();
      const archived = await api()
        .post(`/api/rulesets/${r.id}/archive`)
        .set(auth('ADMIN'))
        .set('If-Match', r.etag);
      expect(archived.body).toMatchObject({ liveVersion: 1 });
      expect((await r.pin(1)).status).toBe(409);
    });
  });
});
