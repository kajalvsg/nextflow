export function AuthFormSkeleton() {
  return (
    <div
      className="w-full animate-pulse rounded-card border border-border bg-surface p-8"
      aria-hidden
    >
      <div className="stack">
        <div className="mx-auto h-6 w-40 rounded bg-surface-muted" />
        <div className="h-4 w-56 rounded bg-surface-muted" />
        <div className="h-10 w-full rounded-button bg-surface-muted" />
        <div className="h-10 w-full rounded-button bg-surface-muted" />
        <div className="h-10 w-full rounded-button bg-accent/40" />
      </div>
    </div>
  );
}
