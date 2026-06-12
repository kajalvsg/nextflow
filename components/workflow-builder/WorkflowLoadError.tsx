import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

type WorkflowLoadErrorProps = {
  message: string;
};

export function WorkflowLoadError({ message }: WorkflowLoadErrorProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="stack-sm max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h1 className="text-display text-foreground">Could not open workflow</h1>
        <p className="text-body text-muted">{message}</p>
      </div>
      <Button href="/dashboard" variant="secondary">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Button>
      <Link
        href="/dashboard"
        className="text-body-sm text-muted transition-colors hover:text-foreground"
      >
        Create a new workflow
      </Link>
    </div>
  );
}
