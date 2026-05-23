"use client";

import { usePathname } from "next/navigation";
import { AuthHeader } from "@/components/auth";

export function ConditionalAuthHeader() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");

  if (isDashboard) {
    return null;
  }

  return <AuthHeader />;
}
