import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  FormField,
  Input,
  Textarea,
  toast,
} from '@rule-studio/ui';
import type { RulesetsApi } from '../data/api';
import { messageOf, statusOf } from '../data/errors';

// New ruleset: name and description; the API gives it a starter draft (spec 003).
export function CreateRulesetDialog({
  api,
  open,
  onOpenChange,
}: {
  api: RulesetsApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setNameError('Give the ruleset a name.');
    setBusy(true);
    try {
      const ruleset = await api.create({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      toast.success(`Created "${ruleset.name}"`);
      onOpenChange(false);
      navigate(ruleset.id);
    } catch (error) {
      if (statusOf(error) === 409) setNameError(messageOf(error));
      else
        toast.error('Could not create the ruleset', {
          description: messageOf(error),
        });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setName('');
          setDescription('');
          setNameError(undefined);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="New ruleset"
        description="It starts with one input field and no rules. You can rename it later."
      >
        <form className="grid gap-4" onSubmit={create} noValidate>
          <FormField label="Name" error={nameError}>
            <Input
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
            />
          </FormField>
          <FormField label="Description" hint="Optional">
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
            <Button type="submit" loading={busy}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
