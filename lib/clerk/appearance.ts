import { dark } from "@clerk/themes";

/**
 * Shared Clerk appearance for the entire app.
 * Used by ClerkProvider — covers sign-in, sign-up, UserButton, and modals.
 *
 * When adding new Clerk components, add matching element keys here AND
 * styles in app/globals.css under the "Clerk dark UI" section.
 */
export const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#8b7cf7",
    colorBackground: "#16161c",
    colorInputBackground: "#1c1c24",
    colorInputText: "#f4f4f5",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
    colorTextOnPrimaryBackground: "#ffffff",
    colorDanger: "#f87171",
    colorNeutral: "#a1a1aa",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
  },
  elements: {
    /* ── Shared ── */
    rootBox: "mx-auto w-full text-foreground",
    cardBox: "shadow-card",
    card: "bg-surface border border-border rounded-xl text-foreground",
    logoBox: "hidden",

    /* ── Sign in / Sign up ── */
    headerTitle: "text-foreground text-heading-sm",
    headerSubtitle: "text-muted",
    formHeaderTitle: "text-foreground",
    formHeaderSubtitle: "text-muted",
    formFieldLabel: "text-foreground text-label",
    formFieldInput:
      "bg-surface-muted border-border text-foreground placeholder:text-muted-foreground rounded-button",
    formFieldInputShowPasswordButton: "text-muted hover:text-foreground",
    formButtonPrimary:
      "bg-accent hover:bg-accent-hover text-accent-foreground rounded-button",
    footerActionText: "text-muted",
    footerActionLink: "text-accent hover:text-accent-hover",
    footerPages: "text-muted",
    footerPagesLink: "text-accent hover:text-accent-hover",
    identityPreviewText: "text-foreground",
    identityPreviewEditButton: "text-accent",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
    alertText: "text-foreground",
    formResendCodeLink: "text-accent",
    otpCodeFieldInput: "bg-surface-muted border-border text-foreground",
    socialButtonsBlockButton:
      "!bg-white hover:!bg-zinc-100 !text-zinc-900 !border !border-zinc-200 rounded-button",
    socialButtonsBlockButtonText: "!text-zinc-900 font-medium",
    socialButtonsProviderIcon: "opacity-100",

    /* ── UserButton popover ── */
    userButtonBox: "flex",
    userButtonTrigger: "focus:shadow-none",
    userButtonAvatarBox: "h-9 w-9 ring-2 ring-border",
    userButtonPopoverCard:
      "bg-surface border border-border rounded-xl shadow-elevated text-foreground",
    userButtonPopoverMain: "text-foreground",
    userButtonPopoverHeader: "text-foreground border-b border-border-soft",
    userButtonPopoverActions: "text-foreground",
    userButtonPopoverActionButton:
      "text-foreground hover:bg-surface-hover rounded-button",
    userButtonPopoverActionButtonText: "text-foreground",
    userButtonPopoverActionButtonIcon: "text-muted",
    userButtonPopoverFooter: "border-t border-border-soft bg-surface-muted",
    userPreview: "text-foreground",
    userPreviewAvatarContainer: "ring-2 ring-border",
    userPreviewMainIdentifier: "text-foreground font-medium",
    userPreviewSecondaryIdentifier: "text-muted text-body-sm",
    userPreviewTextContainer: "text-foreground",
  },
};
