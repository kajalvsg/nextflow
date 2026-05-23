import { cn } from "@/lib/utils/cn";
import type { WithChildren, WithClassName } from "@/types";

type AppShellProps = WithChildren & WithClassName;

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col bg-background text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
