import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';
import { Button } from './button';
import { Checkbox } from './checkbox';
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from './dialog';
import { FormField } from './form-field';
import { Input } from './input';
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

const meta = { title: 'Components/Overlays and inputs' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const DialogStory: Story = {
  name: 'Dialog',
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>New ruleset</Button>
      </DialogTrigger>
      <DialogContent
        title="New ruleset"
        description="You can change the name later."
      >
        <FormField label="Name">
          <Input />
        </FormField>
        <FormField label="Description">
          <Textarea />
        </FormField>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Confirm: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete rule
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Delete this rule?"
          description="It disappears from the draft. Published versions keep it."
          confirmLabel="Delete"
          destructive
          onConfirm={() => undefined}
        />
      </>
    );
  },
};

export const SelectStory: Story = {
  name: 'Select',
  render: () => (
    <div className="max-w-xs">
      <FormField label="Hit strategy">
        <Select
          defaultValue="FIRST"
          options={[
            { value: 'FIRST', label: 'First match' },
            { value: 'PRIORITY', label: 'Strictest decision' },
          ]}
        />
      </FormField>
    </div>
  ),
};

export const TabsStory: Story = {
  name: 'Tabs',
  render: () => (
    <Tabs defaultValue="draft">
      <TabsList aria-label="Ruleset">
        <TabsTrigger value="draft">Draft</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="draft">The draft editor goes here.</TabsContent>
      <TabsContent value="history">Published versions go here.</TabsContent>
    </Tabs>
  ),
};

export const TableStory: Story = {
  name: 'Table',
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>Comment</TableHead>
          <TableHead>Published</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            2 <Badge variant="outline">Live</Badge>
          </TableCell>
          <TableCell>Lower the approval score to 750</TableCell>
          <TableCell>3 days ago</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>1</TableCell>
          <TableCell>First release</TableCell>
          <TableCell>10 days ago</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const Toggles: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="live" />
        <Label htmlFor="live">Make this version live</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="enabled" defaultChecked />
        <Label htmlFor="enabled">Rule enabled</Label>
      </div>
    </div>
  ),
};

export const Toasts: Story = {
  render: () => (
    <>
      <Toaster />
      <div className="flex gap-2">
        <Button onClick={() => toast.success('Draft saved')}>Success</Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.error('Could not publish', {
              description: 'Fix 2 problems first.',
            })
          }
        >
          Error
        </Button>
      </div>
    </>
  ),
};
