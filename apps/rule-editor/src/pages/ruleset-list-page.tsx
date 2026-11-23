import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FilePlus2, Plus, Search } from 'lucide-react';
import type { HostProps } from '@rule-studio/host';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@rule-studio/ui';
import { messageOf } from '../data/errors';
import { usePermissions, useRulesetsApi } from '../data/use-api';
import { useDebounced } from '../data/use-debounced';
import { useResource } from '../data/use-resource';
import { CreateRulesetDialog } from './create-ruleset-dialog';
import { formatDate } from './format';

const PAGE_SIZE = 10;

// The ruleset list (spec 005). Search, tab and page live in the URL, so a
// reload or a shared link shows the same list.
export function RulesetListPage({ host }: HostProps) {
  const api = useRulesetsApi(host);
  const { canEdit } = usePermissions(host);
  const [params, setParams] = useSearchParams();
  const status = params.get('status') === 'archived' ? 'archived' : 'active';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';
  const [creating, setCreating] = useState(false);

  // The box updates as you type; the URL (and the request) only after a pause.
  const [search, setSearch] = useState(q);
  const debounced = useDebounced(search);
  useEffect(() => {
    if (debounced !== q) update({ q: debounced, page: '1' });
    // Only when the debounced text changes; q follows it through the URL.
  }, [debounced]);

  function update(changes: Record<string, string>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (
            value &&
            !(key === 'page' && value === '1') &&
            !(key === 'status' && value === 'active')
          )
            next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }

  const list = useResource(
    (signal) => api.list({ status, q, page, pageSize: PAGE_SIZE }, signal),
    [api, status, q, page],
  );
  const pages = list.data
    ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE))
    : 1;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Rulesets</h1>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> New ruleset
          </Button>
        )}
      </div>

      {/* The tabs wrap the list, which sits in the active tab's panel: a tab
          must control a panel that exists (axe: aria-valid-attr-value). */}
      <Tabs
        className="grid gap-4"
        value={status}
        onValueChange={(value) => update({ status: value, page: '1' })}
      >
        <div className="flex flex-wrap items-center gap-3">
          <TabsList aria-label="Ruleset status">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
          <div className="relative ml-auto w-full max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              className="pl-8"
              aria-label="Search rulesets by name"
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value={status} className="mt-0">
          {list.error && !list.data ? (
            <ErrorState
              title="Couldn't load rulesets"
              description={messageOf(list.error)}
              onRetry={list.reload}
            />
          ) : !list.data ? (
            <div
              className="grid gap-2"
              aria-busy="true"
              aria-label="Loading rulesets"
            >
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : list.data.items.length === 0 ? (
            <EmptyState
              icon={FilePlus2}
              title={
                q
                  ? `No rulesets match "${q}"`
                  : status === 'archived'
                    ? 'No archived rulesets'
                    : 'No rulesets yet'
              }
              description={
                q
                  ? 'Try a different search.'
                  : canEdit && status === 'active'
                    ? 'Create one to start writing rules.'
                    : undefined
              }
              action={
                !q && canEdit && status === 'active' ? (
                  <Button onClick={() => setCreating(true)}>New ruleset</Button>
                ) : undefined
              }
            />
          ) : (
            <div aria-busy={list.loading}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Live</TableHead>
                    <TableHead>Latest</TableHead>
                    <TableHead>Last change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.map((ruleset) => (
                    <TableRow key={ruleset.id}>
                      <TableCell>
                        <Link
                          to={ruleset.id}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {ruleset.name}
                        </Link>
                        {ruleset.hasUnpublishedChanges && (
                          <Badge variant="outline" className="ml-2">
                            Unpublished changes
                          </Badge>
                        )}
                        {ruleset.description && (
                          <p className="max-w-md truncate text-xs text-muted-foreground">
                            {ruleset.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {ruleset.liveVersion ? `v${ruleset.liveVersion}` : '—'}
                      </TableCell>
                      <TableCell>
                        {ruleset.latestVersion
                          ? `v${ruleset.latestVersion}`
                          : 'Draft only'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(ruleset.updatedAt)}
                        <span className="block text-xs">
                          by {ruleset.updatedBy.displayName}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <nav
                aria-label="Pages"
                className="mt-3 flex items-center justify-end gap-2 text-sm"
              >
                <span className="text-muted-foreground">
                  Page {page} of {pages} · {list.data.total} ruleset
                  {list.data.total === 1 ? '' : 's'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => update({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => update({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </nav>
            </div>
          )}
        </TabsContent>
      </Tabs>
      <CreateRulesetDialog
        api={api}
        open={creating}
        onOpenChange={setCreating}
      />
    </div>
  );
}
