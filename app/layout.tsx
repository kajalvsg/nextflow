import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import { Inter, Geist_Mono } from "next/font/google";
import { ConditionalAuthHeader } from "@/components/layout/ConditionalAuthHeader";
import { AppShell } from "@/components/layout";
import { siteConfig } from "@/config/site";
import { clerkAppearance } from "@/lib/clerk/appearance";
import { CLERK_AUTH_PATHS } from "@/lib/clerk/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full font-sans">
        <ClerkProvider
          appearance={clerkAppearance}
          ui={ui}
          signInUrl={CLERK_AUTH_PATHS.signIn}
          signUpUrl={CLERK_AUTH_PATHS.signUp}
          signInFallbackRedirectUrl={CLERK_AUTH_PATHS.afterAuth}
          signUpFallbackRedirectUrl={CLERK_AUTH_PATHS.afterAuth}
        >
          <AppShell>
            <ConditionalAuthHeader />
            {children}
          </AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
