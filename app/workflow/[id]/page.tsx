import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getWorkflowForBuilder } from "@/actions/workflow-builder";
import { isWorkflowBuilderLoadError } from "@/lib/workflow/builder-load-error";
import { WorkflowBuilder } from "@/components/workflow-builder/WorkflowBuilder";
import { WorkflowLoadError } from "@/components/workflow-builder/WorkflowLoadError";

export const metadata: Metadata = {
  title: "Workflow",
};

type WorkflowPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  if (!id?.trim()) {
    redirect("/dashboard");
  }

  try {
    const workflow = await getWorkflowForBuilder(id);

    if (!workflow) {
      notFound();
    }

    return <WorkflowBuilder workflow={workflow} />;
  } catch (error) {
    if (isWorkflowBuilderLoadError(error)) {
      if (error.code === "UNAUTHORIZED") {
        redirect("/sign-in");
      }

      return <WorkflowLoadError message={error.message} />;
    }

    throw error;
  }
}
