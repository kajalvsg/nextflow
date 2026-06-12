import type { Metadata } from "next";
import { AppShellWithSidebar } from "@/components/layout";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShellWithSidebar>{children}</AppShellWithSidebar>;
}
