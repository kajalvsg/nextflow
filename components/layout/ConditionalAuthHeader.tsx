"use client";

import { usePathname } from "next/navigation";
import { AuthHeader } from "@/components/auth";
import { CLERK_AUTH_PATHS } from "@/lib/clerk/config";

export function ConditionalAuthHeader() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith(CLERK_AUTH_PATHS.afterAuth);
  const isWorkflowBuilder = pathname.startsWith("/workflow");
  const isAuthPage =
    pathname.startsWith(CLERK_AUTH_PATHS.signIn) ||
    pathname.startsWith(CLERK_AUTH_PATHS.signUp);

  if (isDashboard || isAuthPage || isWorkflowBuilder) {
    return null;
  }

  return <AuthHeader />;
}
