import { FilePlus2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@rule-studio/ui';
import './styles.css';

// Placeholder until spec 005 (rule editor).
export function App() {
  return (
    <Card id="rule-editor" data-testid="rule-editor">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Rulesets</CardTitle>
          <Badge variant="outline">Coming in spec 005</Badge>
        </div>
        <CardDescription>
          Write and publish rules that approve, reject or refer an application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={FilePlus2}
          title="No rulesets yet"
          description="Rulesets you create will appear here."
          action={<Button disabled>Create ruleset</Button>}
        />
      </CardContent>
    </Card>
  );
}

export default App;
