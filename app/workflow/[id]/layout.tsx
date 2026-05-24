export default function WorkflowLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
