import {
  ApiError,
  type ApiClient,
  type Method,
  type RequestOptions,
} from '@rule-studio/api-client';
import { can } from '@rule-studio/permissions';
import type {
  ProblemDetails,
  Role,
  Ruleset,
  RulesetContent,
  RulesetVersion,
} from '@rule-studio/shared-types';
import { validateRulesetContent } from '@rule-studio/ruleset-validation';
import { deepEqual } from '../editor/deep-equal';
import { loanApproval } from './fixtures';

// An in-memory stand-in for the spec 003 API, for screen tests. It keeps the
// rules that matter to the editor: revisions with If-Match (412, 428),
// "nothing to publish" (409), problems block publishing (422), unique names
// (409), and makeLive needs ruleset:pin (403).

interface Stored {
  ruleset: Omit<Ruleset, 'validation' | 'hasUnpublishedChanges'>;
  versions: RulesetVersion[];
}

const person = (role: Role) => ({
  id: `id-${role}`,
  displayName: `Demo ${role.toLowerCase()}`,
});
const clone = <T>(value: T): T => structuredClone(value);

// What the list endpoint returns: a ruleset without its draft or validation.
function summaryOf(ruleset: Ruleset) {
  const summary: Partial<Ruleset> = { ...ruleset };
  delete summary.draft;
  delete summary.validation;
  return summary;
}

function withoutContent(version: RulesetVersion) {
  const summary: Partial<RulesetVersion> = { ...version };
  delete summary.content;
  return summary;
}

export function createFakeRulesetsApi(role: Role = 'EDITOR') {
  const store = new Map<string, Stored>();
  let clock = Date.parse('2026-11-20T10:00:00Z');
  const now = () => new Date((clock += 60_000)).toISOString();
  const calls: string[] = [];
  // Lets a test make the next request fail or wait.
  const state = {
    failNext: null as { status: number; detail: string } | null,
    gate: null as Promise<void> | null,
  };

  const fail = (
    status: number,
    detail: string,
    extra: Record<string, unknown> = {},
  ): never => {
    throw new ApiError(status, {
      type: 'about:blank',
      title: String(status),
      status,
      detail,
      ...extra,
    } as ProblemDetails);
  };

  function view(s: Stored): Ruleset {
    const latest = s.versions.at(-1);
    const problems = validateRulesetContent(s.ruleset.draft);
    return clone({
      ...s.ruleset,
      hasUnpublishedChanges:
        !latest || !deepEqual(latest.content, s.ruleset.draft),
      validation: { valid: problems.length === 0, problems },
    });
  }

  function add(
    name: string,
    draft: RulesetContent = loanApproval(),
    options: { archived?: boolean; versions?: number } = {},
  ): Ruleset {
    const id = `ruleset-${store.size + 1}`;
    const stamp = now();
    const s: Stored = {
      ruleset: {
        id,
        name,
        revision: 1,
        latestVersion: null,
        liveVersion: null,
        archivedAt: options.archived ? stamp : null,
        createdAt: stamp,
        createdBy: person('EDITOR'),
        updatedAt: stamp,
        updatedBy: person('EDITOR'),
        draft: clone(draft),
      },
      versions: [],
    };
    for (let n = 1; n <= (options.versions ?? 0); n++)
      publishNow(s, { comment: `Version ${n}` }, 'EDITOR');
    store.set(id, s);
    return view(s);
  }

  function publishNow(
    s: Stored,
    body: { comment?: string; makeLive?: boolean },
    by: Role,
  ) {
    const version = (s.ruleset.latestVersion ?? 0) + 1;
    const live = s.ruleset.liveVersion === null || body.makeLive === true;
    s.versions.push({
      version,
      comment: body.comment || null,
      contentHash: String(version).padStart(64, '0'),
      publishedAt: now(),
      publishedBy: person(by),
      isLive: false,
      content: clone(s.ruleset.draft),
    });
    s.ruleset.latestVersion = version;
    if (live) s.ruleset.liveVersion = version;
    s.ruleset.revision++;
    return version;
  }

  function find(id: string): Stored {
    return store.get(id) ?? fail(404, 'No ruleset with this id.');
  }

  function change(
    s: Stored,
    options: RequestOptions | undefined,
    allowArchived = false,
  ) {
    const header = options?.headers?.['If-Match'];
    if (!header) fail(428, 'Send If-Match.');
    if (!allowArchived && s.ruleset.archivedAt)
      fail(409, 'This ruleset is archived. Unarchive it to change it.');
    if (header !== `"${s.ruleset.revision}"`)
      fail(412, 'Someone changed this ruleset after you loaded it.', {
        currentRevision: s.ruleset.revision,
      });
    s.ruleset.revision++;
    s.ruleset.updatedAt = now();
    s.ruleset.updatedBy = person(role);
  }

  const need = (permission: Parameters<typeof can>[1]) =>
    can(role, permission) || fail(403, 'Forbidden');

  async function request<T>(
    method: Method,
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    calls.push(`${method} ${url}`);
    if (state.gate) await state.gate;
    if (state.failNext) {
      const { status, detail } = state.failNext;
      state.failNext = null;
      fail(status, detail);
    }
    const [path, query = ''] = url.split('?');
    const parts = path.split('/').filter(Boolean).slice(2); // after /api/rulesets
    const [id, sub, number, action] = parts;

    if (!id) {
      if (method === 'GET') {
        const params = new URLSearchParams(query);
        const archived = params.get('status') === 'archived';
        const q = (params.get('q') ?? '').toLowerCase();
        const page = Number(params.get('page') ?? 1);
        const pageSize = Number(params.get('pageSize') ?? 20);
        const all = [...store.values()]
          .filter(
            (s) =>
              !!s.ruleset.archivedAt === archived &&
              s.ruleset.name.toLowerCase().includes(q),
          )
          .map(view)
          .reverse();
        const items = all
          .slice((page - 1) * pageSize, page * pageSize)
          .map(summaryOf);
        return { items, total: all.length, page, pageSize } as T;
      }
      need('ruleset:edit');
      const { name, description } = body as {
        name: string;
        description?: string;
      };
      if (
        [...store.values()].some(
          (s) => s.ruleset.name.toLowerCase() === name.toLowerCase(),
        )
      )
        fail(409, `A ruleset named "${name}" already exists.`);
      const created = add(name, {
        schemaVersion: 1,
        inputFields: [{ key: 'amount', label: 'Amount', type: 'NUMBER' }],
        hitStrategy: 'FIRST',
        defaultAction: { decision: 'REFER', reason: 'No rule matched' },
        rules: [],
      });
      if (description) find(created.id).ruleset.description = description;
      return view(find(created.id)) as T;
    }

    const s = find(id);
    if (!sub) {
      if (method === 'GET') return view(s) as T;
      need('ruleset:edit');
      change(s, options);
      Object.assign(s.ruleset, body);
      return view(s) as T;
    }
    if (sub === 'draft') {
      need('ruleset:edit');
      change(s, options);
      s.ruleset.draft = clone(body as RulesetContent);
      return view(s) as T;
    }
    if (sub === 'live') {
      need('ruleset:pin');
      const version = (body as { version: number }).version;
      if (!s.versions.some((v) => v.version === version))
        fail(404, `This ruleset has no version ${version}.`);
      s.ruleset.liveVersion = version;
      return view(s) as T;
    }
    if (sub === 'archive' || sub === 'unarchive') {
      need('ruleset:archive');
      change(s, options, true);
      s.ruleset.archivedAt = sub === 'archive' ? now() : null;
      return view(s) as T;
    }
    if (sub === 'versions') {
      const withLive = (v: RulesetVersion) =>
        clone({ ...v, isLive: v.version === s.ruleset.liveVersion });
      if (!number) {
        if (method === 'GET')
          return [...s.versions].reverse().map((full) => ({
            ...withoutContent(full),
            isLive: full.version === s.ruleset.liveVersion,
          })) as T;
        need('ruleset:publish');
        const publish = (body ?? {}) as {
          comment?: string;
          makeLive?: boolean;
        };
        if (publish.makeLive && !can(role, 'ruleset:pin'))
          fail(
            403,
            'Only users who may pin the live version can publish with makeLive.',
          );
        const latest = s.versions.at(-1);
        if (latest && deepEqual(latest.content, s.ruleset.draft)) {
          const header = options?.headers?.['If-Match'];
          if (header === `"${s.ruleset.revision}"`)
            fail(
              409,
              `Nothing to publish: the draft is the same as version ${latest.version}.`,
            );
        }
        const problems = validateRulesetContent(s.ruleset.draft);
        if (problems.length) fail(422, 'The draft has problems.', { problems });
        const header = options?.headers?.['If-Match'];
        if (header !== `"${s.ruleset.revision}"`)
          fail(412, 'Stale', { currentRevision: s.ruleset.revision });
        const version = publishNow(s, publish, role);
        return withLive(s.versions[version - 1]) as T;
      }
      const v =
        s.versions.find((x) => x.version === Number(number)) ??
        fail(404, `This ruleset has no version ${number}.`);
      if (action === 'restore') {
        need('ruleset:edit');
        change(s, options);
        s.ruleset.draft = clone(v.content);
        return view(s) as T;
      }
      return withLive(v) as T;
    }
    return fail(404, 'Not found');
  }

  const api: ApiClient = {
    request,
    get: (p, o) => request('GET', p, undefined, o),
    post: (p, b, o) => request('POST', p, b, o),
    put: (p, b, o) => request('PUT', p, b, o),
    patch: (p, b, o) => request('PATCH', p, b, o),
    delete: (p, o) => request('DELETE', p, undefined, o),
  };

  return {
    api,
    calls,
    add,
    // A change "someone else" makes, moving the revision on.
    changeBehindYourBack(id: string) {
      const s = find(id);
      s.ruleset.draft.defaultAction.reason = 'Changed by someone else';
      s.ruleset.revision++;
    },
    draftOf: (id: string) => clone(find(id).ruleset.draft),
    stored: (id: string) => view(find(id)),
    versionsOf: (id: string) => clone(find(id).versions),
    failNext(status: number, detail = 'Failed') {
      state.failNext = { status, detail };
    },
    hold() {
      let release!: () => void;
      state.gate = new Promise((r) => (release = r));
      return () => {
        state.gate = null;
        release();
      };
    },
  };
}
