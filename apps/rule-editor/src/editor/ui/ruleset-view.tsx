import type { RulesetContent } from '@rule-studio/shared-types';
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rule-studio/ui';
import { describeGroup } from '../describe';
import { DECISION_BADGE } from './draft-editor';

// A ruleset in words, with no controls (spec 005): what viewers see, what an
// archived ruleset shows, and how a published version is displayed.
const TYPE_LABEL = {
  STRING: 'Text',
  NUMBER: 'Number',
  BOOLEAN: 'True / false',
  DATE: 'Date',
} as const;

export function RulesetView({ content }: { content: RulesetContent }) {
  const rules = [...content.rules].sort((a, b) => a.priority - b.priority);
  return (
    <div className="grid gap-6">
      <section aria-labelledby="view-fields" className="grid gap-3">
        <h2 id="view-fields" className="font-semibold">
          Input fields
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Allowed values</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {content.inputFields.map((f) => (
              <TableRow key={f.key}>
                <TableCell>{f.label}</TableCell>
                <TableCell className="font-mono text-xs">{f.key}</TableCell>
                <TableCell>{TYPE_LABEL[f.type]}</TableCell>
                <TableCell>{f.allowedValues?.join(', ') ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section aria-labelledby="view-strategy" className="grid gap-1">
        <h2 id="view-strategy" className="font-semibold">
          How rules decide
        </h2>
        <p className="text-sm">
          {content.hitStrategy === 'FIRST'
            ? 'First match: the first rule that matches, in priority order, decides.'
            : 'Strictest decision: every rule runs; Reject beats Refer beats Approve.'}{' '}
          When no rule matches:{' '}
          <Badge variant={DECISION_BADGE[content.defaultAction.decision]}>
            {content.defaultAction.decision.toLowerCase()}
          </Badge>
          {content.defaultAction.reason && (
            <> ({content.defaultAction.reason})</>
          )}
        </p>
      </section>
      <section aria-labelledby="view-rules" className="grid gap-3">
        <h2 id="view-rules" className="font-semibold">
          Rules
        </h2>
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">No rules.</p>
        )}
        <ol className="grid gap-2">
          {rules.map((rule) => (
            <li key={rule.id}>
              <Card className={rule.enabled ? undefined : 'opacity-70'}>
                <CardContent className="grid gap-1 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      #{rule.priority}
                    </span>
                    <h3 className="font-medium">{rule.name}</h3>
                    <Badge variant={DECISION_BADGE[rule.then.decision]}>
                      {rule.then.decision.toLowerCase()}
                    </Badge>
                    {!rule.enabled && <Badge variant="outline">Disabled</Badge>}
                  </div>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground">
                      {rule.description}
                    </p>
                  )}
                  <p className="text-sm">
                    <span className="font-medium">When</span>{' '}
                    {describeGroup(rule.when, content.inputFields)}
                    {rule.then.reason && (
                      <>
                        {' '}
                        <span className="font-medium">then</span>{' '}
                        {rule.then.reason}
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
