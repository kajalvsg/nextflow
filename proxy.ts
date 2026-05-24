import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only /dashboard is protected. /sign-in and /sign-up must stay public.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/workflow(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
