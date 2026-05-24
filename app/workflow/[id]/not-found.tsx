import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function WorkflowNotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="stack-sm max-w-md">
        <p className="text-label text-accent">404</p>
        <h1 className="text-display text-foreground">Workflow not found</h1>
        <p className="text-body text-muted">
          This workflow may have been deleted, or you may not have access to it.
        </p>
      </div>
      <Button href="/dashboard" variant="secondary">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Button>
      <Link
        href="/dashboard"
        className="text-body-sm text-muted transition-colors hover:text-foreground"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
