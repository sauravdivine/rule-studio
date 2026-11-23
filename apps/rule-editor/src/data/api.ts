import type { ApiClient } from '@rule-studio/api-client';
import type {
  CreateRulesetRequest,
  PublishRequest,
  Ruleset,
  RulesetContent,
  RulesetPage,
  RulesetVersion,
  RulesetVersionSummary,
  UpdateRulesetRequest,
} from '@rule-studio/shared-types';

// Every call the rule editor makes, typed from the contract (spec 003).
// Changes send If-Match with the revision they were based on.

export interface ListQuery {
  status: 'active' | 'archived';
  q: string;
  page: number;
  pageSize: number;
}

const base = (id: string) => `/api/rulesets/${encodeURIComponent(id)}`;
const ifMatch = (revision: number) => ({
  headers: { 'If-Match': `"${revision}"` },
});

export function rulesetsApi(api: ApiClient) {
  return {
    list(query: ListQuery, signal?: AbortSignal) {
      const params = new URLSearchParams({
        status: query.status,
        page: String(query.page),
        pageSize: String(query.pageSize),
        ...(query.q ? { q: query.q } : {}),
      });
      return api.get<RulesetPage>(`/api/rulesets?${params}`, { signal });
    },
    get: (id: string, signal?: AbortSignal) =>
      api.get<Ruleset>(base(id), { signal }),
    create: (body: CreateRulesetRequest) =>
      api.post<Ruleset>('/api/rulesets', body),
    rename: (id: string, revision: number, body: UpdateRulesetRequest) =>
      api.patch<Ruleset>(base(id), body, ifMatch(revision)),
    saveDraft: (id: string, revision: number, draft: RulesetContent) =>
      api.put<Ruleset>(`${base(id)}/draft`, draft, ifMatch(revision)),
    publish: (id: string, revision: number, body: PublishRequest) =>
      api.post<RulesetVersion>(`${base(id)}/versions`, body, ifMatch(revision)),
    versions: (id: string, signal?: AbortSignal) =>
      api.get<RulesetVersionSummary[]>(`${base(id)}/versions`, { signal }),
    version: (id: string, version: number, signal?: AbortSignal) =>
      api.get<RulesetVersion>(`${base(id)}/versions/${version}`, { signal }),
    restore: (id: string, version: number, revision: number) =>
      api.post<Ruleset>(
        `${base(id)}/versions/${version}/restore`,
        undefined,
        ifMatch(revision),
      ),
    pin: (id: string, version: number) =>
      api.put<Ruleset>(`${base(id)}/live`, { version }),
    archive: (id: string, revision: number) =>
      api.post<Ruleset>(`${base(id)}/archive`, undefined, ifMatch(revision)),
    unarchive: (id: string, revision: number) =>
      api.post<Ruleset>(`${base(id)}/unarchive`, undefined, ifMatch(revision)),
  };
}

export type RulesetsApi = ReturnType<typeof rulesetsApi>;
