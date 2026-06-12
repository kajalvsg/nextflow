/**
 * Shared Clerk appearance for the entire app.
 * Used by ClerkProvider — covers sign-in, sign-up, UserButton, and modals.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#7c3aed",
    colorBackground: "#ffffff",
    colorInputBackground: "#f3f3f6",
    colorInputText: "#111118",
    colorText: "#111118",
    colorTextSecondary: "#71717a",
    colorTextOnPrimaryBackground: "#ffffff",
    colorDanger: "#ef4444",
    colorNeutral: "#71717a",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full text-foreground",
    cardBox: "shadow-card",
    card: "bg-surface border border-border rounded-xl text-foreground",
    logoBox: "hidden",

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
