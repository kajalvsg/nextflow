"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { AuthFormSkeleton } from "@/components/auth/AuthFormSkeleton";
import { clerkAppearance } from "@/lib/clerk/appearance";
import { CLERK_AUTH_PATHS } from "@/lib/clerk/config";

/**
 * Client wrapper for Clerk SignIn — shows a skeleton until Clerk is ready
 * so the auth page is never blank.
 */
export function ClerkSignIn() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <AuthFormSkeleton />;
  }

  return (
    <SignIn
      appearance={clerkAppearance}
      routing="path"
      path={CLERK_AUTH_PATHS.signIn}
      signUpUrl={CLERK_AUTH_PATHS.signUp}
      fallbackRedirectUrl={CLERK_AUTH_PATHS.afterAuth}
    />
  );
}
