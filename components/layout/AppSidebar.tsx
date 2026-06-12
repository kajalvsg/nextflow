"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Boxes,
  GitBranch,
  Loader2,
  Plus,
  Search,
  Settings,
  ListTodo,
  FolderKanban,
  Plug,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { CLERK_AUTH_PATHS } from "@/lib/clerk/config";
import { cn } from "@/lib/utils/cn";
import { useAppSidebarActions } from "./AppSidebarActionsContext";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: "new-task";
};

const NAV_ITEMS: NavItem[] = [
  { id: "new-task", label: "New Task", href: "#", icon: Plus, action: "new-task" },
  { id: "search", label: "Search Tasks", href: CLERK_AUTH_PATHS.afterAuth, icon: Search },
  { id: "tasks", label: "Tasks", href: CLERK_AUTH_PATHS.afterAuth, icon: ListTodo },
  { id: "projects", label: "Projects", href: CLERK_AUTH_PATHS.afterAuth, icon: FolderKanban },
  { id: "library", label: "Library", href: CLERK_AUTH_PATHS.afterAuth, icon: BookOpen },
  { id: "flow", label: "Flow", href: CLERK_AUTH_PATHS.afterAuth, icon: GitBranch },
  { id: "nodes", label: "Nodes", href: CLERK_AUTH_PATHS.afterAuth, icon: Boxes },
  { id: "api", label: "API / MCP", href: CLERK_AUTH_PATHS.afterAuth, icon: Plug },
];

function getActiveNavId(pathname: string): string {
  if (pathname.startsWith("/workflow")) {
    return "flow";
  }

  if (pathname.startsWith(CLERK_AUTH_PATHS.afterAuth)) {
    return "tasks";
  }

  return "tasks";
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { onNewTask, isNewTaskPending } = useAppSidebarActions();
  const activeId = getActiveNavId(pathname);

  const displayName =
    user?.fullName ?? user?.firstName ?? user?.username ?? "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="app-sidebar flex h-full w-[280px] shrink-0 flex-col border-r border-border-soft bg-surface">
      <div className="px-5 pb-4 pt-5">
        <Link
          href={CLERK_AUTH_PATHS.afterAuth}
          className="text-[1.35rem] font-bold tracking-tight text-foreground"
        >
          {siteConfig.name}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="stack-sm">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            if (item.action === "new-task") {
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={onNewTask}
                    disabled={isNewTaskPending}
                    className="app-sidebar-nav-item w-full disabled:cursor-not-allowed disabled:opacity-60"
                    aria-busy={isNewTaskPending}
                  >
                    {isNewTaskPending ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4 shrink-0" />
                    )}
                    <span>{isNewTaskPending ? "Creating..." : item.label}</span>
                  </button>
                </li>
              );
            }

            const isActive = item.id === activeId;

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "app-sidebar-nav-item",
                    isActive && "app-sidebar-nav-item-active",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {pathname.startsWith(CLERK_AUTH_PATHS.afterAuth) &&
        !pathname.startsWith("/workflow") ? (
          <p className="mt-8 px-3 text-body-sm text-muted-foreground">
            Use New Task to create a workflow
          </p>
        ) : null}
      </nav>

      <div className="border-t border-border-soft px-3 py-4">
        <button
          type="button"
          className="app-sidebar-nav-item mb-3 w-full"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          className="mb-3 flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-body-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Claim Offer
        </button>

        <div className="flex items-center gap-3 rounded-card px-3 py-2">
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt={displayName}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-accent/20"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-body-sm font-medium text-foreground">
              {displayName}
            </p>
            <p className="truncate text-caption text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
