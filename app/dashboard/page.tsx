import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkflows } from "@/actions/workflows";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { toWorkflowDTO } from "@/types/workflow";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const workflows = await getWorkflows();
  const workflowDTOs = workflows.map(toWorkflowDTO);

  return (
    <DashboardContent
      initialWorkflows={workflowDTOs}
      userName={user?.firstName}
    />
  );
}
