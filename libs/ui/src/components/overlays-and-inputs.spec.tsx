import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '../test/axe';
import { Button } from './button';
import { Checkbox } from './checkbox';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from './dialog';
import { FormField } from './form-field';
import { Label } from './label';
import { Select } from './select';
import { Switch } from './switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Textarea } from './textarea';
import { toast, Toaster } from './toaster';

describe('Dialog', () => {
  function Example() {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>New ruleset</Button>
        </DialogTrigger>
        <DialogContent title="New ruleset" description="Give it a name.">
          <FormField label="Name">
            <input />
          </FormField>
          <DialogFooter>
            <Button>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  it('is labelled by its title, moves focus inside, and closes on Escape with focus back on the trigger', async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'New ruleset' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'New ruleset' });
    expect(dialog).toHaveAccessibleDescription('Give it a name.');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(await axeViolations(document.body)).toEqual([]);

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  function Example({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this rule?"
        description="This can't be undone after you save."
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
      />
    );
  }

  it('starts on Cancel, so a stray Enter does nothing destructive', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Example onConfirm={onConfirm} />);
    expect(
      await screen.findByRole('alertdialog', { name: 'Delete this rule?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Example onConfirm={onConfirm} />);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('Select', () => {
  const options = [
    { value: 'FIRST', label: 'First match' },
    { value: 'PRIORITY', label: 'Strictest decision' },
  ];

  it('works with FormField and picks an option from the keyboard', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FormField label="Hit strategy" hint="How rules combine">
        <Select options={options} value="FIRST" onValueChange={onValueChange} />
      </FormField>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Hit strategy' });
    expect(trigger).toHaveTextContent('First match');
    expect(trigger).toHaveAccessibleDescription('How rules combine');

    trigger.focus();
    await user.keyboard('{Enter}');
    await user.click(
      await screen.findByRole('option', { name: 'Strictest decision' }),
    );
    expect(onValueChange).toHaveBeenCalledWith('PRIORITY');
  });
});

describe('Tabs', () => {
  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="draft">
        <TabsList aria-label="Ruleset">
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="draft">Draft panel</TabsContent>
        <TabsContent value="history">History panel</TabsContent>
      </Tabs>,
    );
    screen.getByRole('tab', { name: 'Draft' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('History panel');
  });
});

describe('Checkbox and Switch', () => {
  it('toggle, and report their state to assistive technology', async () => {
    const user = userEvent.setup();
    render(
      <>
        <div className="flex items-center gap-2">
          <Checkbox id="live" />
          <Label htmlFor="live">Make this version live</Label>
        </div>
        <Switch aria-label="Rule enabled" defaultChecked />
      </>,
    );
    const checkbox = screen.getByRole('checkbox', {
      name: 'Make this version live',
    });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    const toggle = screen.getByRole('switch', { name: 'Rule enabled' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
  });
});

describe('Toaster', () => {
  it('shows a toast in a live region', async () => {
    render(<Toaster />);
    toast.success('Draft saved');
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });
});

describe('form controls and table together', () => {
  it('have no accessibility violations', async () => {
    const { container } = render(
      <main>
        <FormField label="Comment">
          <Textarea />
        </FormField>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>2</TableCell>
              <TableCell>Lower the approval score</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Switch aria-label="Enabled" />
        <Checkbox aria-label="Select row" />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
