"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Boxes,
  GitBranch,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
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
import { useSidebarLayout } from "./SidebarLayoutContext";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: "new-task";
};

const NAV_ITEMS: NavItem[] = [
  { id: "new-task", label: "New task", href: "#", icon: Plus, action: "new-task" },
  { id: "search", label: "Search tasks", href: CLERK_AUTH_PATHS.afterAuth, icon: Search },
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

function SidebarNavButton({
  label,
  collapsed,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn("app-sidebar-nav-item w-full", className)}
      {...props}
    >
      {children}
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

function SidebarNavLink({
  label,
  collapsed,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & {
  label: string;
  collapsed: boolean;
}) {
  return (
    <Link
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn("app-sidebar-nav-item", className)}
      {...props}
    >
      {children}
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { onNewTask, isNewTaskPending } = useAppSidebarActions();
  const { collapsed, toggleCollapsed } = useSidebarLayout();
  const activeId = getActiveNavId(pathname);

  const displayName =
    user?.fullName ?? user?.firstName ?? user?.username ?? "User";
  const email =
    user?.primaryEmailAddress?.emailAddress ?? "Signed in";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        "app-sidebar relative flex h-full shrink-0 flex-col border-r border-border-soft bg-surface transition-[width] duration-200 ease-out",
        collapsed ? "app-sidebar-collapsed w-[72px]" : "w-[260px]",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          collapsed ? "px-3 pb-3 pt-4" : "px-4 pb-3 pt-4",
        )}
      >
        <Link
          href={CLERK_AUTH_PATHS.afterAuth}
          className={cn(
            "app-sidebar-logo min-w-0 truncate text-foreground",
            collapsed ? "mx-auto text-center text-sm" : undefined,
          )}
          title={siteConfig.name}
        >
          {collapsed ? siteConfig.name.charAt(0) : siteConfig.name}
        </Link>

        {!collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="app-sidebar-collapse-btn flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="app-sidebar-collapse-btn absolute right-2 top-4 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <nav className="shrink-0 px-3">
        <ul className="app-sidebar-nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            if (item.action === "new-task") {
              return (
                <li key={item.id}>
                  <SidebarNavButton
                    label={isNewTaskPending ? "Creating..." : item.label}
                    collapsed={collapsed}
                    onClick={onNewTask}
                    disabled={isNewTaskPending}
                    className="disabled:cursor-not-allowed disabled:opacity-60"
                    aria-busy={isNewTaskPending}
                  >
                    {isNewTaskPending ? (
                      <Loader2 className="app-sidebar-nav-icon animate-spin" />
                    ) : (
                      <Icon className="app-sidebar-nav-icon" />
                    )}
                  </SidebarNavButton>
                </li>
              );
            }

            const isActive = item.id === activeId;

            return (
              <li key={item.id}>
                <SidebarNavLink
                  href={item.href}
                  label={item.label}
                  collapsed={collapsed}
                  className={cn(isActive && "app-sidebar-nav-item-active")}
                >
                  <Icon className="app-sidebar-nav-icon" />
                </SidebarNavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        {!collapsed ? (
          <div className="flex flex-1 items-center justify-center px-4">
            <p className="app-sidebar-empty-state">No tasks yet</p>
          </div>
        ) : null}
      </div>

      <div className="app-sidebar-footer">
        <button
          type="button"
          className={cn(
            "app-sidebar-settings-btn",
            collapsed && "app-sidebar-settings-btn-collapsed",
          )}
          aria-label="Settings"
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="app-sidebar-footer-btn-icon shrink-0" />
          {!collapsed ? <span className="truncate">Settings</span> : null}
        </button>

        {!collapsed ? (
          <button type="button" className="app-sidebar-claim-btn">
            <Gift className="app-sidebar-footer-btn-icon shrink-0" />
            <span className="truncate">Claim Offer</span>
          </button>
        ) : (
          <button
            type="button"
            className="app-sidebar-claim-btn app-sidebar-claim-btn-collapsed"
            aria-label="Claim Offer"
            title="Claim Offer"
          >
            <Gift className="app-sidebar-footer-btn-icon shrink-0" />
          </button>
        )}

        {!collapsed ? (
          <div className="app-sidebar-footer-chevron" aria-hidden="true">
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        ) : null}

        <div
          className={cn(
            "app-sidebar-profile",
            collapsed && "app-sidebar-profile-collapsed",
          )}
        >
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt={displayName}
              className="app-sidebar-profile-avatar"
              title={collapsed ? displayName : undefined}
            />
          ) : (
            <div
              className="app-sidebar-profile-avatar app-sidebar-profile-avatar-fallback"
              title={collapsed ? displayName : undefined}
            >
              {initial}
            </div>
          )}
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="app-sidebar-profile-name truncate">{displayName}</p>
              <p className="app-sidebar-profile-email truncate">{email}</p>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
