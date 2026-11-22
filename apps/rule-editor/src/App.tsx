import { FilePlus2, Pencil, Upload } from 'lucide-react';
import type { HostProps } from '@rule-studio/host';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@rule-studio/ui';
import './styles.css';

// Placeholder until spec 005 (rule editor). Shows the role-aware pattern every
// remote follows: ask host.can() and leave out what the user may not do, so
// they never see a button that would end in a 403.
export function App({ host }: HostProps) {
  const canEdit = host.can('ruleset:edit');
  const canPublish = host.can('ruleset:publish');
  const readOnly = !canEdit && !canPublish;

  return (
    <Card data-testid="rule-editor">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Rulesets</CardTitle>
          <Badge variant="outline">Coming in spec 005</Badge>
          {readOnly && <Badge variant="neutral">Read only</Badge>}
        </div>
        <CardDescription>
          Write and publish rules that approve, reject or refer an application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={FilePlus2}
          title="No rulesets yet"
          description={
            readOnly
              ? `Signed in as ${host.user.displayName}. You can browse rulesets once they exist.`
              : 'Rulesets you create will appear here.'
          }
          action={
            canEdit ? <Button disabled>Create ruleset</Button> : undefined
          }
        />
      </CardContent>
      {!readOnly && (
        <CardFooter>
          {canEdit && (
            <Button variant="outline" size="sm">
              <Pencil aria-hidden="true" /> Edit
            </Button>
          )}
          {canPublish && (
            <Button size="sm">
              <Upload aria-hidden="true" /> Publish
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

export default App;
