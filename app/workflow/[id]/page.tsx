import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getWorkflowForBuilder } from "@/actions/workflow-builder";
import { WorkflowBuilder } from "@/components/workflow-builder/WorkflowBuilder";

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

  const workflow = await getWorkflowForBuilder(id);

  if (!workflow) {
    notFound();
  }

  return <WorkflowBuilder workflow={workflow} />;
}
