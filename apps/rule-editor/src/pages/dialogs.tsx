import { useEffect, useState } from 'react';
import type { Ruleset } from '@rule-studio/shared-types';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  FormField,
  Input,
  Label,
  Textarea,
} from '@rule-studio/ui';

// The ruleset page's dialogs (spec 005).

export function PublishDialog({
  open,
  onOpenChange,
  ruleset,
  canPin,
  busy,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleset: Ruleset;
  canPin: boolean;
  busy: boolean;
  onPublish: (body: { comment: string; makeLive: boolean }) => void;
}) {
  const [comment, setComment] = useState('');
  const [makeLive, setMakeLive] = useState(false);
  const first = ruleset.latestVersion === null;
  const next = (ruleset.latestVersion ?? 0) + 1;
  useEffect(() => {
    if (open) {
      setComment('');
      setMakeLive(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Publish version ${next}`}
        description="Published versions never change. You can always restore one into the draft later."
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onPublish({ comment: comment.trim(), makeLive: first || makeLive });
          }}
        >
          <FormField
            label="What changed?"
            hint={`Optional. ${500 - comment.length} characters left.`}
          >
            <Textarea
              value={comment}
              maxLength={500}
              onChange={(e) => setComment(e.target.value)}
            />
          </FormField>
          {first ? (
            <p className="text-sm text-muted-foreground">
              This is the first version, so it becomes the live version.
            </p>
          ) : (
            canPin && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="make-live"
                  checked={makeLive}
                  onCheckedChange={(v) => setMakeLive(v === true)}
                />
                <Label htmlFor="make-live">
                  Make this version live (now v{ruleset.liveVersion})
                </Label>
              </div>
            )
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Publish v{next}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RenameDialog({
  open,
  onOpenChange,
  ruleset,
  busy,
  nameError,
  onRename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleset: Ruleset;
  busy: boolean;
  nameError?: string;
  onRename: (body: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState(ruleset.name);
  const [description, setDescription] = useState(ruleset.description ?? '');
  useEffect(() => {
    if (open) {
      setName(ruleset.name);
      setDescription(ruleset.description ?? '');
    }
  }, [open, ruleset]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Rename ruleset"
        description="Names and descriptions aren't versioned: the change applies at once."
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onRename({ name: name.trim(), description: description.trim() });
          }}
        >
          <FormField
            label="Name"
            error={
              nameError ??
              (name.trim() ? undefined : 'Give the ruleset a name.')
            }
          >
            <Input
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Shown on 412: someone else changed the ruleset after it was loaded here.
export function ConflictDialog({
  open,
  onOpenChange,
  onReload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="alertdialog"
        title="Someone else changed this ruleset"
        description="It was saved by someone else after you opened it, so your change wasn't saved, and nothing of theirs was overwritten."
      >
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onReload();
              onOpenChange(false);
            }}
          >
            Load their version (discard mine)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
