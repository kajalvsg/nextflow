import { AuthFormSkeleton } from "@/components/auth/AuthFormSkeleton";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default function SignUpLoading() {
  return (
    <AuthPageShell>
      <AuthFormSkeleton />
    </AuthPageShell>
  );
}
