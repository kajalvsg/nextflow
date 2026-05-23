// Do not modify this route structure; Clerk requires catch-all routes.

import type { Metadata } from "next";
import { ClerkSignUp } from "@/components/auth/ClerkSignUp";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage() {
  return (
    <AuthPageShell>
      <ClerkSignUp />
    </AuthPageShell>
  );
}
