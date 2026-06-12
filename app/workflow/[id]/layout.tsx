import { AppShellWithSidebar } from "@/components/layout";

export default function WorkflowLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShellWithSidebar>{children}</AppShellWithSidebar>;
}
