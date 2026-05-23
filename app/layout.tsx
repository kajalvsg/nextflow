import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Geist_Mono } from "next/font/google";
import { AuthHeader } from "@/components/auth";
import { AppShell } from "@/components/layout";
import { siteConfig } from "@/config/site";
import { clerkAppearance } from "@/lib/clerk/appearance";
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
        <ClerkProvider appearance={clerkAppearance}>
          <AppShell>
            <AuthHeader />
            {children}
          </AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
