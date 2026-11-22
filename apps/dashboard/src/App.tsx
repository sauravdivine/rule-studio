import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@rule-studio/ui';
import './styles.css';

// Placeholder until spec 008 (dashboard). The skeletons hint at the layout to come.
export function App() {
  return (
    <Card id="dashboard" data-testid="dashboard">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Dashboard</CardTitle>
          <Badge variant="outline">Coming in spec 008</Badge>
        </div>
        <CardDescription>
          Decision volumes and outcome rates per ruleset.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 rounded-md border p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default App;
