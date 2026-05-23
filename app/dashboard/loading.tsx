import { Container, PageSection } from "@/components/layout";
import { Card } from "@/components/ui/Card";

export default function DashboardLoading() {
  return (
    <PageSection spacing="lg">
      <Container size="lg">
        <div className="stack-lg">
          <div className="stack-sm">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
            <div className="h-10 w-64 animate-pulse rounded bg-surface-muted" />
            <div className="h-5 w-96 max-w-full animate-pulse rounded bg-surface-muted" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} variant="elevated" padding="md">
                <div className="stack">
                  <div className="h-6 w-3/4 animate-pulse rounded bg-surface-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-surface-muted" />
                  <div className="divider pt-4">
                    <div className="flex gap-2">
                      <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
                      <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </PageSection>
  );
}
