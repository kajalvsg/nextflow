"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { CLERK_AUTH_PATHS } from "@/lib/clerk/config";
import { cn } from "@/lib/utils/cn";

type SidebarAccountSectionProps = {
  collapsed: boolean;
};

function ProfileAvatar({
  imageUrl,
  displayName,
  initial,
  className,
}: {
  imageUrl?: string | null;
  displayName: string;
  initial: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={displayName}
        className={cn("app-sidebar-profile-avatar", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "app-sidebar-profile-avatar app-sidebar-profile-avatar-fallback",
        className,
      )}
    >
      {initial}
    </div>
  );
}

export function SidebarAccountSection({ collapsed }: SidebarAccountSectionProps) {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const displayName =
    user?.fullName ?? user?.firstName ?? user?.username ?? "User";
  const email =
    user?.primaryEmailAddress?.emailAddress ?? "Signed in";
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as HTMLElement)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  const handleManageAccount = () => {
    setOpen(false);
    openUserProfile();
  };

  const handleSignOut = () => {
    setOpen(false);
    void signOut({ redirectUrl: CLERK_AUTH_PATHS.signIn });
  };

  return (
    <div ref={rootRef} className="app-sidebar-account-wrap">
      {open ? (
        <div
          className="app-sidebar-account-menu"
          role="menu"
          aria-label="Account menu"
        >
          <div className="app-sidebar-account-menu-header">
            <ProfileAvatar
              imageUrl={user?.imageUrl}
              displayName={displayName}
              initial={initial}
              className="app-sidebar-account-menu-avatar"
            />
            <div className="min-w-0 flex-1">
              <p className="app-sidebar-account-menu-name truncate">
                {displayName}
              </p>
              <p className="app-sidebar-account-menu-email truncate">{email}</p>
            </div>
          </div>

          <div className="app-sidebar-account-menu-actions">
            <button
              type="button"
              role="menuitem"
              className="app-sidebar-account-menu-item"
              onClick={handleManageAccount}
            >
              Manage account
            </button>
            <button
              type="button"
              role="menuitem"
              className="app-sidebar-account-menu-item app-sidebar-account-menu-item-danger"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          "app-sidebar-profile app-sidebar-profile-trigger",
          collapsed && "app-sidebar-profile-collapsed",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed ? displayName : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <ProfileAvatar
          imageUrl={user?.imageUrl}
          displayName={displayName}
          initial={initial}
        />
        {!collapsed ? (
          <p className="app-sidebar-profile-name truncate">{displayName}</p>
        ) : null}
      </button>
    </div>
  );
}
