"use client";

import { AppSidebar } from "./AppSidebar";
import { AppSidebarActionsProvider } from "./AppSidebarActionsContext";
import { SidebarLayoutProvider } from "./SidebarLayoutContext";

type AppShellWithSidebarProps = {
  children: React.ReactNode;
};

export function AppShellWithSidebar({ children }: AppShellWithSidebarProps) {
  return (
    <SidebarLayoutProvider>
      <AppSidebarActionsProvider>
        <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-background">
          <AppSidebar />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </AppSidebarActionsProvider>
    </SidebarLayoutProvider>
  );
}
