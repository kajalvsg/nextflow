import type { WithChildren } from "@/types";

export function AuthPageShell({ children }: WithChildren) {
  return (
    <div className="clerk-auth flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md justify-center">{children}</div>
    </div>
  );
}
