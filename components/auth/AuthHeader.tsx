"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Container } from "@/components/layout";
import { siteConfig } from "@/config/site";
import { clerkAppearance } from "@/lib/clerk/appearance";

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
                href="/sign-in"
                className="rounded-button px-4 py-2 text-body-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-button bg-accent px-4 py-2 text-body-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
              >
                Sign up
              </Link>
            </Show>

            <Show when="signed-in">
              <Link
                href="/dashboard"
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
