import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkflows } from "@/actions/workflows";
import { getDbErrorMessage } from "@/lib/db/retry";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { toWorkflowDTO } from "@/types/workflow";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  let workflowDTOs: ReturnType<typeof toWorkflowDTO>[] = [];
  let dbError: string | null = null;

  try {
    const workflows = await getWorkflows();
    workflowDTOs = workflows.map(toWorkflowDTO);
  } catch (error) {
    console.error("[DashboardPage]", error);
    dbError = getDbErrorMessage(error);
  }

  return (
    <DashboardContent
      initialWorkflows={workflowDTOs}
      userName={user?.firstName}
      dbError={dbError}
    />
  );
}
