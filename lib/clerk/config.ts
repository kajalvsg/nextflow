/**
 * Single source of truth for Clerk auth URLs.
 * Keep in sync with .env.example and ClerkProvider props in app/layout.tsx.
 */
export const CLERK_AUTH_PATHS = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  afterAuth: "/dashboard",
} as const;

export const CLERK_ENV_KEYS = {
  publishableKey: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  secretKey: "CLERK_SECRET_KEY",
  signInUrl: "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  signUpUrl: "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  signInFallbackRedirectUrl: "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
  signUpFallbackRedirectUrl: "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
} as const;
