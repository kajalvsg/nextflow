"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { clerkAppearance } from "@/lib/clerk/appearance";
import { Container } from "@/components/layout";
import { CreateWorkflowDialog } from "./CreateWorkflowDialog";

type DashboardNavbarProps = {
  userName?: string | null;
};

export function DashboardNavbar({ userName }: DashboardNavbarProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <header className="border-b border-border-soft bg-surface/80 backdrop-blur-sm">
        <Container>
          <div className="flex h-16 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <Link
                href="/"
                className="text-heading-sm text-foreground transition-colors hover:text-accent"
              >
                {siteConfig.name}
              </Link>
              <span className="hidden text-muted-foreground sm:inline">/</span>
              <span className="hidden text-body-sm text-muted sm:inline">
                Dashboard
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create Workflow
              </Button>
              <UserButton appearance={clerkAppearance} />
            </div>
          </div>
        </Container>
      </header>

      {userName ? (
        <Container className="pt-8">
          <div className="stack-sm">
            <p className="text-label text-accent">Workflow dashboard</p>
            <h1 className="text-display text-foreground">
              Welcome back, {userName}
            </h1>
            <p className="text-body-lg text-muted">
              Create, manage, and organize your AI workflows in one place.
            </p>
          </div>
        </Container>
      ) : null}

      <CreateWorkflowDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
