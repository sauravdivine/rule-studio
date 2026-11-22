import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@rule-studio/ui';
import './styles.css';

// Placeholder until spec 007 (simulator).
export function App() {
  return (
    <Card id="simulator" data-testid="simulator">
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
        <Button variant="outline" size="sm" className="ml-auto" disabled>
          Run simulation
        </Button>
      </CardContent>
    </Card>
  );
}

export default App;
