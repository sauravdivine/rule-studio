import { useState } from 'react';
import { RotateCcw, Star } from 'lucide-react';
import type { Ruleset, RulesetVersionSummary } from '@rule-studio/shared-types';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rule-studio/ui';
import type { RulesetsApi } from '../data/api';
import { messageOf } from '../data/errors';
import { useResource } from '../data/use-resource';
import { RulesetView } from '../editor/ui/ruleset-view';
import { formatDate } from './format';

// The History tab (spec 005): every published version, newest first.
export function HistoryTab({
  api,
  ruleset,
  canRestore,
  canPin,
  hasUnsavedChanges,
  onRestore,
  onPin,
}: {
  api: RulesetsApi;
  ruleset: Ruleset;
  canRestore: boolean;
  canPin: boolean;
  hasUnsavedChanges: boolean;
  onRestore: (version: number) => Promise<void>;
  onPin: (version: number) => Promise<void>;
}) {
  // Reloads when the ruleset changes (after a publish or a pin), so the live
  // badge and the list stay right. Hand-written fetching: we have to remember
  // to do this ourselves.
  const versions = useResource(
    (signal) => api.versions(ruleset.id, signal),
    [api, ruleset.id, ruleset.latestVersion, ruleset.liveVersion],
  );
  const [viewing, setViewing] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

  if (versions.error && !versions.data) {
    return (
      <ErrorState
        title="Couldn't load the history"
        description={messageOf(versions.error)}
        onRetry={versions.reload}
      />
    );
  }
  if (!versions.data) {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label="Loading history">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (versions.data.length === 0) {
    return (
      <EmptyState
        title="Nothing published yet"
        description="Publish the draft to create version 1."
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Comment</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.data.map((v: RulesetVersionSummary) => (
            <TableRow key={v.version}>
              <TableCell className="whitespace-nowrap">
                v{v.version} {v.isLive && <Badge variant="approve">Live</Badge>}
              </TableCell>
              <TableCell className="max-w-sm text-sm">
                {v.comment ?? (
                  <span className="text-muted-foreground">No comment</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(v.publishedAt)}
                <span className="block text-xs">
                  by {v.publishedBy.displayName}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`View version ${v.version}`}
                    onClick={() => setViewing(v.version)}
                  >
                    View
                  </Button>
                  {canRestore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Restore version ${v.version} into the draft`}
                      onClick={() =>
                        hasUnsavedChanges
                          ? setConfirmRestore(v.version)
                          : void onRestore(v.version)
                      }
                    >
                      <RotateCcw aria-hidden="true" /> Restore
                    </Button>
                  )}
                  {canPin && !v.isLive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Make version ${v.version} live`}
                      onClick={() => void onPin(v.version)}
                    >
                      <Star aria-hidden="true" /> Make live
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <VersionDialog
        api={api}
        rulesetId={ruleset.id}
        version={viewing}
        onClose={() => setViewing(null)}
      />
      <ConfirmDialog
        open={confirmRestore !== null}
        onOpenChange={(open) => !open && setConfirmRestore(null)}
        title={`Restore version ${confirmRestore} into the draft?`}
        description="Your unsaved changes will be lost. Saved and published work isn't affected."
        confirmLabel="Restore"
        destructive
        onConfirm={() =>
          confirmRestore !== null && void onRestore(confirmRestore)
        }
      />
    </>
  );
}

function VersionDialog({
  api,
  rulesetId,
  version,
  onClose,
}: {
  api: RulesetsApi;
  rulesetId: string;
  version: number | null;
  onClose: () => void;
}) {
  const loaded = useResource(
    (signal) =>
      version === null
        ? Promise.resolve(null)
        : api.version(rulesetId, version, signal),
    [api, rulesetId, version],
  );
  return (
    <Dialog open={version !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] max-w-3xl overflow-y-auto"
        title={`Version ${version}`}
        description={
          loaded.data
            ? `${loaded.data.comment ?? 'No comment'} · published ${formatDate(loaded.data.publishedAt)} by ${loaded.data.publishedBy.displayName}`
            : undefined
        }
      >
        {loaded.error ? (
          <ErrorState
            description={messageOf(loaded.error)}
            onRetry={loaded.reload}
          />
        ) : loaded.data && loaded.data.version === version ? (
          <RulesetView content={loaded.data.content} />
        ) : (
          <Spinner label="Loading version" />
        )}
      </DialogContent>
    </Dialog>
  );
}
