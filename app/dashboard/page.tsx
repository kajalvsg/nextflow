import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkflows } from "@/actions/workflows";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { WorkflowList } from "@/components/dashboard/WorkflowList";
import { Container, PageSection } from "@/components/layout";
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
    <>
      <DashboardNavbar userName={user?.firstName} />
      <PageSection spacing="lg">
        <Container size="lg">
          <div className="stack-lg">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="stack-sm">
                <h2 className="text-heading text-foreground">Your workflows</h2>
                <p className="text-body-sm text-muted">
                  {workflowDTOs.length === 0
                    ? "No workflows yet. Create one to get started."
                    : `${workflowDTOs.length} workflow${workflowDTOs.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>

            <WorkflowList workflows={workflowDTOs} />
          </div>
        </Container>
      </PageSection>
    </>
  );
}
