"use client";

import { createContext, useContext, useState } from "react";

type SidebarLayoutContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(
  null,
);

export function SidebarLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarLayoutContext.Provider
      value={{
        collapsed,
        toggleCollapsed: () => setCollapsed((current) => !current),
      }}
    >
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function useSidebarLayout() {
  const context = useContext(SidebarLayoutContext);

  if (!context) {
    throw new Error("useSidebarLayout must be used within SidebarLayoutProvider");
  }

  return context;
}
