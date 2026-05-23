import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Container, PageSection } from "@/components/layout";
import { Card } from "@/components/ui";

export default function Home() {
  return (
    <PageSection spacing="lg">
      <Container size="md">
        <div className="stack-lg">
          <div className="stack-sm">
            <p className="text-label text-accent">AI workflow platform</p>
            <h1 className="text-display text-foreground">Nextflow</h1>
            <p className="text-body-lg text-muted max-w-xl">
              Build and orchestrate AI-powered workflows. Sign in to access your
              dashboard.
            </p>
          </div>

          <Card variant="elevated" padding="lg">
            <div className="stack">
              <h2 className="text-heading-sm text-foreground">Get started</h2>
              <p className="text-body-sm text-muted">
                Create an account or sign in to reach the protected dashboard.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Show when="signed-out">
                  <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
                    <button
                      type="button"
                      className="rounded-button border border-border bg-surface px-4 py-2 text-body-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                    >
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
                    <button
                      type="button"
                      className="rounded-button bg-accent px-4 py-2 text-body-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
                    >
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <Link
                    href="/dashboard"
                    className="rounded-button bg-accent px-4 py-2 text-body-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
                  >
                    Go to dashboard
                  </Link>
                </Show>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </PageSection>
  );
}
