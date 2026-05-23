"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Container } from "@/components/layout";
import { siteConfig } from "@/config/site";
import { clerkAppearance } from "@/lib/clerk/appearance";
import { CLERK_AUTH_PATHS } from "@/lib/clerk/config";

export function AuthHeader() {
  return (
    <header className="border-b border-border-soft bg-surface/80 backdrop-blur-sm">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-heading-sm text-foreground transition-colors hover:text-accent"
          >
            {siteConfig.name}
          </Link>

          <nav className="flex items-center gap-3">
            <Show when="signed-out">
              <Link
                href={CLERK_AUTH_PATHS.signIn}
                className="rounded-button px-4 py-2 text-body-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href={CLERK_AUTH_PATHS.signUp}
                className="rounded-button bg-accent px-4 py-2 text-body-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
              >
                Sign up
              </Link>
            </Show>

            <Show when="signed-in">
              <Link
                href={CLERK_AUTH_PATHS.afterAuth}
                className="rounded-button px-4 py-2 text-body-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <UserButton appearance={clerkAppearance} />
            </Show>
          </nav>
        </div>
      </Container>
    </header>
  );
}
