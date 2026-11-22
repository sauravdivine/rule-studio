import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@rule-studio/ui';
import type { HostProps } from '@rule-studio/host';
import './styles.css';

// Placeholder until spec 007 (simulator).
export function App({ host }: HostProps) {
  return (
    <Card data-testid="simulator">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Simulator</CardTitle>
          <Badge variant="outline">Coming in spec 007</Badge>
        </div>
        <CardDescription>
          Run sample applications through a ruleset and see which rule decided.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Possible outcomes:
        </span>
        <Badge variant="approve">Approve</Badge>
        <Badge variant="reject">Reject</Badge>
        <Badge variant="refer">Refer</Badge>
        {host.can('simulation:run') && (
          <Button variant="outline" size="sm" className="ml-auto" disabled>
            Run simulation
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default App;
