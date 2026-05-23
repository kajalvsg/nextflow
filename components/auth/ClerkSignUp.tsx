"use client";

import { SignUp, useAuth } from "@clerk/nextjs";
import { AuthFormSkeleton } from "@/components/auth/AuthFormSkeleton";
import { clerkAppearance } from "@/lib/clerk/appearance";
import { CLERK_AUTH_PATHS } from "@/lib/clerk/config";

/**
 * Client wrapper for Clerk SignUp — shows a skeleton until Clerk is ready
 * so the auth page is never blank.
 */
export function ClerkSignUp() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <AuthFormSkeleton />;
  }

  return (
    <SignUp
      appearance={clerkAppearance}
      routing="path"
      path={CLERK_AUTH_PATHS.signUp}
      signInUrl={CLERK_AUTH_PATHS.signIn}
      fallbackRedirectUrl={CLERK_AUTH_PATHS.afterAuth}
    />
  );
}
