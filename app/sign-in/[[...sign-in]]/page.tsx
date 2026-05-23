// Do not modify this route structure; Clerk requires catch-all routes.

import type { Metadata } from "next";
import { ClerkSignIn } from "@/components/auth/ClerkSignIn";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <AuthPageShell>
      <ClerkSignIn />
    </AuthPageShell>
  );
}
