export type WithClassName = {
  className?: string;
};

export type WithChildren = {
  children: React.ReactNode;
};

export type {
  ActionResult,
  WorkflowStatus,
  WorkflowSummary,
  WorkflowSummaryDTO,
} from "./workflow";
export { toWorkflowDTO } from "./workflow";
