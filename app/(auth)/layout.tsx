import type { WithChildren } from "@/types";

export default function AuthLayout({ children }: WithChildren) {
  return (
    <div className="clerk-auth flex flex-1 flex-col items-center justify-center px-gutter py-section-lg">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
