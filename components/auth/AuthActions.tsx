"use client";

import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type AuthActionsProps = {
  className?: string;
};

export function AuthActions({ className }: AuthActionsProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Show when="signed-out">
        <Link
          href="/sign-in"
          className="rounded-button border border-border bg-surface px-4 py-2 text-body-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
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
          className="rounded-button bg-accent px-4 py-2 text-body-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Go to dashboard
        </Link>
      </Show>
    </div>
  );
}
