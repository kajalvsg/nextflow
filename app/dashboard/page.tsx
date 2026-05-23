import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Container, PageSection } from "@/components/layout";
import { Card } from "@/components/ui";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  return (
    <PageSection spacing="lg">
      <Container size="md">
        <div className="stack-lg">
          <div className="stack-sm">
            <p className="text-label text-accent">Protected route</p>
            <h1 className="text-display text-foreground">Dashboard</h1>
            <p className="text-body-lg text-muted">
              Welcome back
              {user?.firstName ? `, ${user.firstName}` : ""}. You are signed
              in to {siteConfig.name}.
            </p>
          </div>

          <Card variant="elevated" padding="lg">
            <div className="stack">
              <h2 className="text-heading-sm text-foreground">
                Account overview
              </h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="stack-sm">
                  <dt className="text-label text-muted-foreground">Email</dt>
                  <dd className="text-body text-foreground">
                    {user?.emailAddresses[0]?.emailAddress ?? "—"}
                  </dd>
                </div>
                <div className="stack-sm">
                  <dt className="text-label text-muted-foreground">User ID</dt>
                  <dd className="font-mono text-body-sm text-muted">
                    {userId}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>
      </Container>
    </PageSection>
  );
}
