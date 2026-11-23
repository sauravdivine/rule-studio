import { useEffect, useMemo, useReducer, useState } from 'react';
import { Link, useBlocker, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, MoreHorizontal, Save, Upload } from 'lucide-react';
import type { HostProps } from '@rule-studio/host';
import type { Ruleset, RulesetContent } from '@rule-studio/shared-types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@rule-studio/ui';
import { isConflict, messageOf, statusOf } from '../data/errors';
import { usePermissions, useRulesetsApi } from '../data/use-api';
import { useResource } from '../data/use-resource';
import { deepEqual } from '../editor/deep-equal';
import { draftProblems } from '../editor/problems';
import { editorReducer, initEditor, isDirty } from '../editor/reducer';
import { DraftEditor } from '../editor/ui/draft-editor';
import { RulesetView } from '../editor/ui/ruleset-view';
import { ConflictDialog, PublishDialog, RenameDialog } from './dialogs';
import { HistoryTab } from './history-tab';

// The ruleset screen (spec 005): header and actions, the Draft and History tabs.
export function RulesetPage({ host }: HostProps) {
  const { id = '' } = useParams();
  const api = useRulesetsApi(host);
  const ruleset = useResource((signal) => api.get(id, signal), [api, id]);

  if (ruleset.error && !ruleset.data) {
    return statusOf(ruleset.error) === 404 ? (
      <EmptyState
        title="Ruleset not found"
        description="It may have been removed, or the link is wrong."
        action={
          <Button asChild variant="outline">
            <Link to="..">Back to rulesets</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState
        title="Couldn't load the ruleset"
        description={messageOf(ruleset.error)}
        onRetry={ruleset.reload}
      />
    );
  }
  if (!ruleset.data) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading ruleset">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return (
    <LoadedRuleset
      host={host}
      ruleset={ruleset.data}
      setRuleset={ruleset.setData}
      reload={ruleset.reload}
    />
  );
}

const EMPTY: RulesetContent = {
  schemaVersion: 1,
  inputFields: [],
  hitStrategy: 'FIRST',
  defaultAction: { decision: 'REFER' },
  rules: [],
};

function LoadedRuleset({
  host,
  ruleset,
  setRuleset,
  reload,
}: HostProps & {
  ruleset: Ruleset;
  setRuleset: (r: Ruleset) => void;
  reload: () => void;
}) {
  const api = useRulesetsApi(host);
  const { canEdit, canPublish, canPin, canArchive } = usePermissions(host);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'draft';

  const [editor, dispatch] = useReducer(
    editorReducer,
    ruleset.draft ?? EMPTY,
    initEditor,
  );
  // A new server draft (load, save, restore, someone else's version after a
  // conflict) replaces the editor's. A rename or pin also returns the ruleset,
  // but its draft is unchanged, so unsaved edits are kept.
  useEffect(() => {
    if (!deepEqual(ruleset.draft, editor.saved))
      dispatch({ type: 'load', content: ruleset.draft });
    // Only when the server's ruleset changes.
  }, [ruleset]);

  const archived = ruleset.archivedAt !== null;
  const editable = canEdit && !archived;
  const dirty = isDirty(editor);
  const problems = useMemo(() => draftProblems(editor.draft), [editor.draft]);
  const [busy, setBusy] = useState<'save' | 'publish' | 'rename' | null>(null);
  const [dialog, setDialog] = useState<
    'publish' | 'rename' | 'archive' | 'conflict' | null
  >(null);
  const [renameError, setRenameError] = useState<string>();

  // --- leaving with unsaved changes ---
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault(); // the browser shows its own "Leave site?" prompt
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // --- actions ---
  async function change(
    kind: typeof busy,
    run: () => Promise<Ruleset>,
    success: string,
  ): Promise<boolean> {
    setBusy(kind);
    try {
      setRuleset(await run());
      toast.success(success);
      return true;
    } catch (error) {
      if (isConflict(error)) setDialog('conflict');
      else toast.error('That didn’t work', { description: messageOf(error) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    change(
      'save',
      () => api.saveDraft(ruleset.id, ruleset.revision, editor.draft),
      'Draft saved',
    );

  async function publish(body: { comment: string; makeLive: boolean }) {
    setBusy('publish');
    try {
      const version = await api.publish(ruleset.id, ruleset.revision, {
        ...(body.comment ? { comment: body.comment } : {}),
        // Only send makeLive when it's allowed and asked for (an editor's would be refused).
        ...(body.makeLive && canPin && ruleset.latestVersion !== null
          ? { makeLive: true }
          : {}),
      });
      setDialog(null);
      toast.success(
        `Published version ${version.version}${version.isLive ? ', now live' : ''}`,
      );
      // Publish returns the version, not the ruleset: fetch the ruleset again
      // for its new revision and badges. (A data library would invalidate it for us.)
      setRuleset(await api.get(ruleset.id));
    } catch (error) {
      if (isConflict(error)) setDialog('conflict');
      else toast.error('Couldn’t publish', { description: messageOf(error) });
    } finally {
      setBusy(null);
    }
  }

  async function rename(body: { name: string; description: string }) {
    setRenameError(undefined);
    setBusy('rename');
    try {
      setRuleset(await api.rename(ruleset.id, ruleset.revision, body));
      setDialog(null);
      toast.success('Renamed');
    } catch (error) {
      if (statusOf(error) === 409) setRenameError(messageOf(error));
      else if (isConflict(error)) setDialog('conflict');
      else toast.error('Couldn’t rename', { description: messageOf(error) });
    } finally {
      setBusy(null);
    }
  }

  const restore = async (version: number) => {
    if (
      await change(
        null,
        () => api.restore(ruleset.id, version, ruleset.revision),
        `Version ${version} restored into the draft`,
      )
    ) {
      setParams({}, { replace: true }); // back to the Draft tab to see it
    }
  };
  const pin = async (version: number) => {
    await change(
      null,
      () => api.pin(ruleset.id, version),
      `Version ${version} is now live`,
    );
  };
  const toggleArchive = () =>
    change(
      null,
      () =>
        archived
          ? api.unarchive(ruleset.id, ruleset.revision)
          : api.archive(ruleset.id, ruleset.revision),
      archived ? 'Unarchived' : 'Archived',
    );

  // Why Save or Publish can't be used right now, shown under the buttons.
  const saveBlocked =
    problems.structure.length > 0
      ? `Fix ${problems.structure.length} problem(s) before saving.`
      : null;
  const publishBlocked = dirty
    ? 'Save your changes before publishing.'
    : !ruleset.hasUnpublishedChanges
      ? `Nothing new to publish since version ${ruleset.latestVersion}.`
      : problems.all.length > 0
        ? `Fix ${problems.all.length} problem(s) before publishing.`
        : null;
  const blockedReason =
    (dirty && saveBlocked) ||
    (canPublish && editable && publishBlocked) ||
    null;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link
          to=".."
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Rulesets
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {ruleset.name}
              </h1>
              {ruleset.liveVersion ? (
                <Badge variant="approve">Live v{ruleset.liveVersion}</Badge>
              ) : (
                <Badge variant="outline">Not published</Badge>
              )}
              {ruleset.hasUnpublishedChanges &&
                ruleset.latestVersion !== null && (
                  <Badge variant="outline">Unpublished changes</Badge>
                )}
              {dirty && <Badge variant="refer">Unsaved</Badge>}
              {archived && <Badge variant="neutral">Archived</Badge>}
            </div>
            {ruleset.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {ruleset.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <Button
                variant="outline"
                onClick={() => void save()}
                disabled={!dirty || !!saveBlocked}
                loading={busy === 'save'}
                aria-describedby={blockedReason ? 'action-blocked' : undefined}
              >
                <Save aria-hidden="true" /> Save
              </Button>
            )}
            {canPublish && editable && (
              <Button
                onClick={() => setDialog('publish')}
                disabled={!!publishBlocked}
                aria-describedby={blockedReason ? 'action-blocked' : undefined}
              >
                <Upload aria-hidden="true" /> Publish
              </Button>
            )}
            {(editable || canArchive) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {editable && (
                    <DropdownMenuItem onSelect={() => setDialog('rename')}>
                      Rename
                    </DropdownMenuItem>
                  )}
                  {canArchive && (
                    <DropdownMenuItem onSelect={() => setDialog('archive')}>
                      {archived ? 'Unarchive' : 'Archive'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {blockedReason && (
          <p
            id="action-blocked"
            className="text-right text-xs text-muted-foreground"
          >
            {blockedReason}
          </p>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setParams(value === 'history' ? { tab: 'history' } : {}, {
            replace: true,
          })
        }
      >
        <TabsList aria-label="Ruleset">
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="draft">
          {editable ? (
            <DraftEditor
              draft={editor.draft}
              problems={problems.all}
              dispatch={dispatch}
            />
          ) : (
            <div className="grid gap-4">
              <Alert>
                <AlertTitle>{archived ? 'Archived' : 'Read only'}</AlertTitle>
                <AlertDescription>
                  {archived
                    ? canArchive
                      ? 'Unarchive it to make changes.'
                      : 'Archived rulesets can’t be changed.'
                    : 'You can view this ruleset but not change it.'}
                </AlertDescription>
              </Alert>
              <RulesetView content={editor.draft} />
            </div>
          )}
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab
            api={api}
            ruleset={ruleset}
            canRestore={editable}
            canPin={canPin && !archived}
            hasUnsavedChanges={dirty}
            onRestore={restore}
            onPin={pin}
          />
        </TabsContent>
      </Tabs>

      <PublishDialog
        open={dialog === 'publish'}
        onOpenChange={(open) => setDialog(open ? 'publish' : null)}
        ruleset={ruleset}
        canPin={canPin}
        busy={busy === 'publish'}
        onPublish={(body) => void publish(body)}
      />
      <RenameDialog
        open={dialog === 'rename'}
        onOpenChange={(open) => setDialog(open ? 'rename' : null)}
        ruleset={ruleset}
        busy={busy === 'rename'}
        nameError={renameError}
        onRename={(body) => void rename(body)}
      />
      <ConfirmDialog
        open={dialog === 'archive'}
        onOpenChange={(open) => setDialog(open ? 'archive' : null)}
        title={
          archived
            ? `Unarchive "${ruleset.name}"?`
            : `Archive "${ruleset.name}"?`
        }
        description={
          archived
            ? 'It becomes editable again and shows in the main list.'
            : 'It becomes read-only and moves to the Archived tab. Its live version is kept.'
        }
        confirmLabel={archived ? 'Unarchive' : 'Archive'}
        onConfirm={() => void toggleArchive()}
      />
      <ConflictDialog
        open={dialog === 'conflict'}
        onOpenChange={(open) => setDialog(open ? 'conflict' : null)}
        onReload={reload}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Leave without saving?"
        description="Your changes to the draft haven’t been saved and will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
