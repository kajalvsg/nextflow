import { Container } from "@/components/layout";
import { Card } from "@/components/ui/Card";

export default function WorkflowLoading() {
  return (
    <div className="flex h-full flex-1 items-center justify-center p-6">
      <Container size="sm">
        <Card variant="elevated" padding="lg">
          <div className="stack-sm text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-body-sm text-muted">Loading workflow…</p>
          </div>
        </Card>
      </Container>
    </div>
  );
}
