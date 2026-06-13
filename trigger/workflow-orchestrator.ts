import { task } from "@trigger.dev/sdk/v3";
import { parseStoredGraph } from "@/lib/workflow/canvas";
import {
  EXECUTABLE_NODE_TYPES,
  LOCAL_NODE_TYPES,
  getReadyExecutableNodes,
} from "@/lib/workflow/execution/dag";
import {
  GEMINI_DEMO_FALLBACK_RESPONSE,
  getDemoModeSkipError,
  isDemoModeEnabled,
  shouldUseGeminiDemoFallback,
} from "@/lib/workflow/execution/gemini-demo";
import {
  isGeminiDebugEnabled,
  logGeminiDebug,
  logGeminiEnvSnapshot,
} from "@/lib/workflow/execution/gemini-debug";
import { assertCropImageInputUrl, requireCropImageInputUrl } from "@/lib/workflow/execution/image-input";
import { buildLocalNodeOutput } from "@/lib/workflow/execution/local-nodes";
import {
  buildNodeInputRecord,
  type NodeOutputMap,
} from "@/lib/workflow/execution/resolve-inputs";
import {
  finalizeWorkflowRun,
  markNodeExecutionFailed,
  markNodeExecutionRunning,
  markNodeExecutionSkipped,
  markNodeExecutionSuccess,
  settlePlannedExecutions,
} from "@/lib/workflow/execution/run-store";
import { db, ensureDbReady } from "@/lib/db";
import type { RunScope, RunStatus } from "@/types/workflow-execution";
import type { WorkflowNodeData, WorkflowNodeType } from "@/types/workflow-canvas";
import { cropImageTask } from "./crop-image";
import { geminiProTask } from "./gemini-pro";

function findPlannedNodeId(
  nodes: Array<{ id: string; data: WorkflowNodeData }>,
  plannedNodeIds: Set<string>,
  nodeType: WorkflowNodeType,
): string | undefined {
  return nodes.find(
    (node) => plannedNodeIds.has(node.id) && node.data.nodeType === nodeType,
  )?.id;
}

function logOrchestrator(message: string): void {
  console.info(`[workflow-orchestrator] ${message}`);
}

export type WorkflowOrchestratorPayload = {
  runId: string;
  workflowId: string;
  userId: string;
  scope: RunScope;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  plannedNodeIds: string[];
};

export const workflowOrchestratorTask = task({
  id: "workflow-orchestrator",
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: WorkflowOrchestratorPayload) => {
    await ensureDbReady();

    const run = await db.workflowRun.findUnique({
      where: { id: payload.runId },
      include: { executions: true },
    });

    if (!run) {
      throw new Error("Workflow run not found.");
    }

    const startedAt = run.startedAt;
    const { nodes, edges } = parseStoredGraph(payload.nodes, payload.edges);
    const plannedNodeIds = new Set(payload.plannedNodeIds);
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const executionByNodeId = new Map(
      run.executions.map((execution) => [execution.nodeId, execution]),
    );

    const outputs: NodeOutputMap = new Map();
    const completedNodeIds = new Set<string>();
    let hasFailure = false;
    let hasDemoFallback = false;

    const markSkippedNodes = async () => {
      for (const node of nodes) {
        if (plannedNodeIds.has(node.id)) {
          continue;
        }

        const execution = executionByNodeId.get(node.id);

        if (execution) {
          await markNodeExecutionSkipped(execution.id);
        }
      }
    };

    const runLocalNode = async (nodeId: string) => {
      const node = nodeMap.get(nodeId);

      if (!node || !LOCAL_NODE_TYPES.has(node.data.nodeType)) {
        return;
      }

      const execution = executionByNodeId.get(nodeId);

      if (!execution) {
        return;
      }

      const nodeStartedAt = new Date();
      await markNodeExecutionRunning(execution.id);

      try {
        const input = buildNodeInputRecord(node, edges, outputs, nodes);
        const output = buildLocalNodeOutput(node, edges, outputs, nodes);

        outputs.set(nodeId, output);
        completedNodeIds.add(nodeId);

        await markNodeExecutionSuccess(
          execution.id,
          input,
          output,
          nodeStartedAt,
        );
      } catch (error) {
        hasFailure = true;
        const message =
          error instanceof Error ? error.message : "Local node failed.";

        await markNodeExecutionFailed(
          execution.id,
          buildNodeInputRecord(node, edges, outputs, nodes),
          message,
          nodeStartedAt,
        );
        completedNodeIds.add(nodeId);
      }
    };

    const runExecutableNode = async (nodeId: string) => {
      const node = nodeMap.get(nodeId);

      if (!node || !EXECUTABLE_NODE_TYPES.has(node.data.nodeType)) {
        return;
      }

      const execution = executionByNodeId.get(nodeId);

      if (!execution) {
        return;
      }

      const nodeStartedAt = new Date();
      const input = buildNodeInputRecord(node, edges, outputs, nodes);

      await markNodeExecutionRunning(execution.id);

      try {
        if (node.data.nodeType === "cropImage") {
          assertCropImageInputUrl(input.input_image);
          const inputImage = requireCropImageInputUrl(input.input_image);

          const result = await cropImageTask.triggerAndWait({
            input: {
              input_image: inputImage,
              xPercent: input.xPercent as number,
              yPercent: input.yPercent as number,
              widthPercent: input.widthPercent as number,
              heightPercent: input.heightPercent as number,
            },
          });

          if (!result.ok) {
            const errorMessage =
              result.error instanceof Error
                ? result.error.message
                : typeof result.error === "string"
                  ? result.error
                  : "Crop Image task failed.";
            throw new Error(errorMessage);
          }

          const output = {
            output_image: result.output.output_image,
            width: result.output.width,
            height: result.output.height,
          };

          outputs.set(nodeId, output);
          completedNodeIds.add(nodeId);

          await markNodeExecutionSuccess(
            execution.id,
            input,
            output,
            nodeStartedAt,
          );
          return;
        }

        if (node.data.nodeType === "geminiPro") {
          const applyGeminiDemoFallback = async (errorMessage: string) => {
            const fallbackOutput = {
              response: GEMINI_DEMO_FALLBACK_RESPONSE,
            };

            outputs.set(nodeId, fallbackOutput);
            completedNodeIds.add(nodeId);
            hasFailure = true;
            hasDemoFallback = true;

            await markNodeExecutionFailed(
              execution.id,
              input,
              errorMessage,
              nodeStartedAt,
              fallbackOutput,
            );
          };

          if (isDemoModeEnabled() && !isGeminiDebugEnabled()) {
            await applyGeminiDemoFallback(getDemoModeSkipError());
            return;
          }

          logGeminiEnvSnapshot("orchestrator before gemini-pro triggerAndWait");
          logGeminiDebug("orchestrator gemini input summary", {
            nodeId,
            promptLength: String(input.prompt ?? "").length,
            hasSystemPrompt: Boolean(String(input.system_prompt ?? "").trim()),
            hasImageVision: Boolean(input.image_vision),
          });

          const result = await geminiProTask.triggerAndWait({
            input: {
              prompt: String(input.prompt ?? ""),
              systemPrompt: String(input.system_prompt ?? ""),
              imageUrl: (input.image_vision as string | null) ?? null,
              temperature: input.temperature as number,
              maxOutputTokens: input.maxOutputTokens as number,
            },
          });

          if (!result.ok) {
            const errorMessage =
              result.error instanceof Error
                ? result.error.message
                : typeof result.error === "string"
                  ? result.error
                  : "Gemini task failed.";

            if (shouldUseGeminiDemoFallback(errorMessage) && !isGeminiDebugEnabled()) {
              await applyGeminiDemoFallback(errorMessage);
              return;
            }

            logGeminiDebug("orchestrator gemini-pro task failed (no demo fallback)", {
              nodeId,
              errorMessage,
            });

            throw new Error(errorMessage);
          }

          const output = {
            response: result.output.response,
          };

          outputs.set(nodeId, output);
          completedNodeIds.add(nodeId);

          await markNodeExecutionSuccess(
            execution.id,
            input,
            output,
            nodeStartedAt,
          );
        }
      } catch (error) {
        hasFailure = true;
        const message =
          error instanceof Error ? error.message : "Executable node failed.";

        await markNodeExecutionFailed(execution.id, input, message, nodeStartedAt);
        completedNodeIds.add(nodeId);
      }
    };

    try {
      const requestInputsNodeId = findPlannedNodeId(
        nodes,
        plannedNodeIds,
        "requestInputs",
      );

      if (requestInputsNodeId) {
        logOrchestrator(`running request inputs node ${requestInputsNodeId}`);
        await runLocalNode(requestInputsNodeId);
      }

      const executablePending = nodes
        .filter(
          (node) =>
            plannedNodeIds.has(node.id) &&
            EXECUTABLE_NODE_TYPES.has(node.data.nodeType),
        )
        .map((node) => node.id)
        .filter((nodeId) => !completedNodeIds.has(nodeId));

      while (executablePending.some((nodeId) => !completedNodeIds.has(nodeId))) {
        const ready = getReadyExecutableNodes(
          executablePending.filter((nodeId) => !completedNodeIds.has(nodeId)),
          completedNodeIds,
          edges,
          plannedNodeIds,
        );

        if (ready.length === 0) {
          hasFailure = true;
          break;
        }

        // Trigger.dev forbids Promise.all around triggerAndWait (parallel waits).
        // Run each ready node one at a time; DAG still ensures dependencies first.
        for (const nodeId of ready) {
          await runExecutableNode(nodeId);
        }
      }

      const responseNodeId = findPlannedNodeId(
        nodes,
        plannedNodeIds,
        "response",
      );

      if (responseNodeId) {
        if (!hasFailure || hasDemoFallback) {
          logOrchestrator(`running response node ${responseNodeId}`);
          await runLocalNode(responseNodeId);
        } else {
          const execution = executionByNodeId.get(responseNodeId);

          if (execution) {
            await markNodeExecutionSkipped(execution.id);
          }
        }
      }

      await markSkippedNodes();
      await settlePlannedExecutions(
        run.executions,
        plannedNodeIds,
        completedNodeIds,
        executionByNodeId,
      );

      const finalStatus: RunStatus =
        hasFailure && hasDemoFallback
          ? "partial"
          : hasFailure
            ? payload.scope === "full"
              ? "failed"
              : "partial"
            : "success";

      await finalizeWorkflowRun(payload.runId, finalStatus, startedAt);

      logOrchestrator(
        `completed run ${payload.runId} with status ${finalStatus}`,
      );

      return {
        runId: payload.runId,
        status: finalStatus,
      };
    } catch (error) {
      await settlePlannedExecutions(
        run.executions,
        plannedNodeIds,
        completedNodeIds,
        executionByNodeId,
      );

      await finalizeWorkflowRun(payload.runId, "failed", startedAt);
      throw error;
    }
  },
});
