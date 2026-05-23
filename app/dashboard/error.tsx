"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container, PageSection } from "@/components/layout";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <PageSection spacing="lg">
      <Container size="md">
        <Card variant="elevated" padding="lg">
          <div className="stack">
            <h2 className="text-heading-sm text-foreground">
              Something went wrong
            </h2>
            <p className="text-body-sm text-muted">
              We could not load your workflows. Check your database connection
              and try again.
            </p>
            <Button onClick={reset}>Try again</Button>
          </div>
        </Card>
      </Container>
    </PageSection>
  );
}
