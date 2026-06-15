import { batch, task } from "@trigger.dev/sdk/v3";
import { parseStoredGraph } from "@/lib/workflow/canvas";
import {
  LOCAL_NODE_TYPES,
  computeExecutionLevels,
  getNodeDependencyStatus,
} from "@/lib/workflow/execution/dag";
import {
  getDemoModeSkipError,
  getGeminiFallbackResponse,
  isDemoModeEnabled,
  shouldUseGeminiDemoFallback,
} from "@/lib/workflow/execution/gemini-demo";
import {
  isGeminiDebugEnabled,
  logGeminiDebug,
  logGeminiEnvSnapshot,
} from "@/lib/workflow/execution/gemini-debug";
import {
  assertCropImageInputUrl,
  requireCropImageInputUrl,
} from "@/lib/workflow/execution/image-input";
import { buildLocalNodeOutput } from "@/lib/workflow/execution/local-nodes";
import {
  buildNodeInputRecord,
  countMissingConnectedImages,
  logPropagatedOutputs,
  resolveRequestInputsOutput,
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
import type { WorkflowNodeData } from "@/types/workflow-canvas";
import { cropImageTask } from "./crop-image";
import { geminiProTask } from "./gemini-pro";

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

type ExecutionRecord = {
  id: string;
  nodeId: string;
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
    const executionByNodeId = new Map<string, ExecutionRecord>(
      run.executions.map((execution) => [
        execution.nodeId,
        { id: execution.id, nodeId: execution.nodeId },
      ]),
    );

    const outputs: NodeOutputMap = new Map();

    for (const node of nodes) {
      if (node.data.nodeType === "requestInputs") {
        outputs.set(node.id, resolveRequestInputsOutput(node));
      }
    }

    const successfulNodeIds = new Set<string>();
    const failedNodeIds = new Set<string>();
    const finishedNodeIds = new Set<string>();
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

    const markBlockedNode = async (nodeId: string, reason: string) => {
      const execution = executionByNodeId.get(nodeId);

      if (!execution || finishedNodeIds.has(nodeId)) {
        return;
      }

      logOrchestrator(`blocked node ${nodeId}: ${reason}`);
      failedNodeIds.add(nodeId);
      finishedNodeIds.add(nodeId);
      hasFailure = true;

      await markNodeExecutionSkipped(execution.id);
    };

    const completeNodeSuccess = async (
      nodeId: string,
      input: Record<string, unknown>,
      output: Record<string, unknown>,
      nodeStartedAt: Date,
    ) => {
      const execution = executionByNodeId.get(nodeId);

      if (!execution) {
        return;
      }

      outputs.set(nodeId, output);
      successfulNodeIds.add(nodeId);
      finishedNodeIds.add(nodeId);

      await markNodeExecutionSuccess(
        execution.id,
        input,
        output,
        nodeStartedAt,
      );

      logOrchestrator(`node completed ${nodeId}`);
      logPropagatedOutputs(nodeId, edges, nodes);
    };

    const completeNodeFailure = async (
      nodeId: string,
      input: Record<string, unknown>,
      message: string,
      nodeStartedAt: Date,
      output?: Record<string, unknown>,
    ) => {
      const execution = executionByNodeId.get(nodeId);

      if (!execution) {
        return;
      }

      hasFailure = true;
      failedNodeIds.add(nodeId);
      finishedNodeIds.add(nodeId);

      if (output) {
        outputs.set(nodeId, output);
      }

      await markNodeExecutionFailed(
        execution.id,
        input,
        message,
        nodeStartedAt,
        output,
      );

      logOrchestrator(`node failed ${nodeId}: ${message}`);
    };

    const runLocalNode = async (nodeId: string) => {
      const node = nodeMap.get(nodeId);

      if (!node || !LOCAL_NODE_TYPES.has(node.data.nodeType)) {
        return;
      }

      const execution = executionByNodeId.get(nodeId);

      if (!execution || finishedNodeIds.has(nodeId)) {
        return;
      }

      const dependencyStatus = getNodeDependencyStatus(
        nodeId,
        successfulNodeIds,
        failedNodeIds,
        edges,
        plannedNodeIds,
      );

      if (dependencyStatus === "blocked") {
        await markBlockedNode(nodeId, "upstream dependency failed");
        return;
      }

      if (dependencyStatus === "waiting") {
        return;
      }

      const nodeStartedAt = new Date();
      logOrchestrator(`node started ${nodeId} (${node.data.nodeType})`);
      await markNodeExecutionRunning(execution.id);

      try {
        const input = buildNodeInputRecord(node, edges, outputs, nodes);
        const output = buildLocalNodeOutput(node, edges, outputs, nodes);
        await completeNodeSuccess(nodeId, input, output, nodeStartedAt);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Local node failed.";
        await completeNodeFailure(
          nodeId,
          buildNodeInputRecord(node, edges, outputs, nodes),
          message,
          nodeStartedAt,
        );
      }
    };

    const runCropNode = async (
      nodeId: string,
      batchResult?: {
        ok: boolean;
        output?: { output_image: string; width: number; height: number };
        error?: unknown;
      },
    ) => {
      const node = nodeMap.get(nodeId);

      if (!node || node.data.nodeType !== "cropImage") {
        return;
      }

      const execution = executionByNodeId.get(nodeId);

      if (!execution || finishedNodeIds.has(nodeId)) {
        return;
      }

      const nodeStartedAt = new Date();
      const input = buildNodeInputRecord(node, edges, outputs, nodes);

      try {
        assertCropImageInputUrl(input.input_image);

        let result = batchResult;

        if (!result) {
          await markNodeExecutionRunning(execution.id);
          logOrchestrator(`node started ${nodeId} (cropImage)`);

          result = await cropImageTask.triggerAndWait({
            input: {
              input_image: requireCropImageInputUrl(input.input_image),
              xPercent: input.xPercent as number,
              yPercent: input.yPercent as number,
              widthPercent: input.widthPercent as number,
              heightPercent: input.heightPercent as number,
            },
          });
        }

        if (!result.ok || !result.output) {
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

        await completeNodeSuccess(nodeId, input, output, nodeStartedAt);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Crop Image node failed.";
        await completeNodeFailure(nodeId, input, message, nodeStartedAt);
      }
    };

    const runGeminiNode = async (
      nodeId: string,
      batchResult?: {
        ok: boolean;
        output?: { response: string };
        error?: unknown;
      },
    ) => {
      const node = nodeMap.get(nodeId);

      if (!node || node.data.nodeType !== "geminiPro") {
        return;
      }

      const execution = executionByNodeId.get(nodeId);

      if (!execution || finishedNodeIds.has(nodeId)) {
        return;
      }

      const nodeStartedAt = new Date();
      const input = buildNodeInputRecord(node, edges, outputs, nodes);

      const applyGeminiDemoFallback = async (errorMessage: string) => {
        const fallbackOutput = {
          response: getGeminiFallbackResponse(node.data.label, nodeId),
          _fallback: true,
          _geminiError: errorMessage,
        };

        hasDemoFallback = true;

        await completeNodeSuccess(
          nodeId,
          {
            ...input,
            _geminiError: errorMessage,
          },
          fallbackOutput,
          nodeStartedAt,
        );

        logOrchestrator(`node completed ${nodeId} (gemini fallback)`);
      };

      try {
        if (isDemoModeEnabled() && !isGeminiDebugEnabled()) {
          await markNodeExecutionRunning(execution.id);
          logOrchestrator(`node started ${nodeId} (geminiPro demo)`);
          await applyGeminiDemoFallback(getDemoModeSkipError());
          return;
        }

        let result = batchResult;

        if (!result) {
          await markNodeExecutionRunning(execution.id);
          logOrchestrator(`node started ${nodeId} (geminiPro)`);

          logGeminiEnvSnapshot("orchestrator before gemini-pro triggerAndWait");
          logGeminiDebug("orchestrator gemini input summary", {
            nodeId,
            promptLength: String(input.prompt ?? "").length,
            hasSystemPrompt: Boolean(String(input.system_prompt ?? "").trim()),
            hasImageVision: Boolean(input.image_vision),
          });

          result = await geminiProTask.triggerAndWait({
            input: {
              prompt: String(input.prompt ?? ""),
              systemPrompt: String(input.system_prompt ?? ""),
              imageUrl: (input.image_vision as string | null) ?? null,
              temperature: input.temperature as number,
              maxOutputTokens: input.maxOutputTokens as number,
            },
          });
        }

        if (!result.ok || !result.output) {
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

        await completeNodeSuccess(nodeId, input, output, nodeStartedAt);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Gemini node failed.";
        await completeNodeFailure(nodeId, input, message, nodeStartedAt);
      }
    };

    type LevelBatchEntry =
      | {
          nodeId: string;
          kind: "cropImage";
          input: Record<string, unknown>;
        }
      | {
          nodeId: string;
          kind: "geminiPro";
          input: Record<string, unknown>;
        };

    type TriggerWaitResult = {
      ok: boolean;
      output?: unknown;
      error?: unknown;
    };

    const prepareLevelBatchEntry = (
      nodeId: string,
    ): LevelBatchEntry | "demo-gemini" | "skip" => {
      const node = nodeMap.get(nodeId);

      if (!node) {
        return "skip";
      }

      const input = buildNodeInputRecord(node, edges, outputs, nodes);

      if (node.data.nodeType === "cropImage") {
        try {
          assertCropImageInputUrl(input.input_image);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Crop Image input missing.";
          logOrchestrator(`missing dependency ${nodeId}: ${message}`);
          return "skip";
        }

        return { nodeId, kind: "cropImage", input };
      }

      if (node.data.nodeType === "geminiPro") {
        const missingImages = countMissingConnectedImages(
          nodeId,
          "image_vision",
          edges,
          outputs,
          nodes,
        );

        if (missingImages > 0) {
          logOrchestrator(
            `missing dependency ${nodeId}: ${missingImages} connected image(s) not ready`,
          );
          return "skip";
        }

        if (isDemoModeEnabled() && !isGeminiDebugEnabled()) {
          return "demo-gemini";
        }

        return { nodeId, kind: "geminiPro", input };
      }

      return "skip";
    };

    const runLevelBatch = async (entries: LevelBatchEntry[]) => {
      if (entries.length === 0) {
        return;
      }

      if (entries.length === 1) {
        const entry = entries[0]!;

        if (entry.kind === "cropImage") {
          await runCropNode(entry.nodeId);
        } else {
          await runGeminiNode(entry.nodeId);
        }

        return;
      }

      await Promise.all(
        entries.map(({ nodeId }) => {
          const execution = executionByNodeId.get(nodeId);

          if (!execution) {
            return Promise.resolve();
          }

          logOrchestrator(`node started ${nodeId} (level batch)`);
          return markNodeExecutionRunning(execution.id);
        }),
      );

      const { runs } = await batch.triggerByTaskAndWait(
        entries.map((entry) => {
          if (entry.kind === "cropImage") {
            return {
              task: cropImageTask,
              payload: {
                input: {
                  input_image: requireCropImageInputUrl(entry.input.input_image),
                  xPercent: entry.input.xPercent as number,
                  yPercent: entry.input.yPercent as number,
                  widthPercent: entry.input.widthPercent as number,
                  heightPercent: entry.input.heightPercent as number,
                },
              },
            };
          }

          return {
            task: geminiProTask,
            payload: {
              input: {
                prompt: String(entry.input.prompt ?? ""),
                systemPrompt: String(entry.input.system_prompt ?? ""),
                imageUrl: (entry.input.image_vision as string | null) ?? null,
                temperature: entry.input.temperature as number,
                maxOutputTokens: entry.input.maxOutputTokens as number,
              },
            },
          };
        }),
      );

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]!;
        const result = runs[index] as TriggerWaitResult | undefined;

        if (entry.kind === "cropImage") {
          await runCropNode(entry.nodeId, result as {
            ok: boolean;
            output?: { output_image: string; width: number; height: number };
            error?: unknown;
          });
        } else {
          await runGeminiNode(entry.nodeId, result as {
            ok: boolean;
            output?: { response: string };
            error?: unknown;
          });
        }
      }
    };

    const runExecutionLevel = async (levelNodeIds: string[]) => {
      const runnable: string[] = [];

      for (const nodeId of levelNodeIds) {
        if (!plannedNodeIds.has(nodeId) || finishedNodeIds.has(nodeId)) {
          continue;
        }

        const dependencyStatus = getNodeDependencyStatus(
          nodeId,
          successfulNodeIds,
          failedNodeIds,
          edges,
          plannedNodeIds,
        );

        if (dependencyStatus === "blocked") {
          await markBlockedNode(nodeId, "upstream dependency failed");
          continue;
        }

        if (dependencyStatus === "waiting") {
          logOrchestrator(`missing dependency ${nodeId}: upstream not ready`);
          continue;
        }

        runnable.push(nodeId);
      }

      if (runnable.length === 0) {
        return;
      }

      logOrchestrator(`started level nodes: ${runnable.join(", ")}`);

      const localNodeIds = runnable.filter((nodeId) => {
        const nodeType = nodeMap.get(nodeId)?.data.nodeType;
        return nodeType != null && LOCAL_NODE_TYPES.has(nodeType);
      });
      const executableNodeIds = runnable.filter((nodeId) => {
        const nodeType = nodeMap.get(nodeId)?.data.nodeType;
        return nodeType === "cropImage" || nodeType === "geminiPro";
      });

      await Promise.all(localNodeIds.map((nodeId) => runLocalNode(nodeId)));

      const batchEntries: LevelBatchEntry[] = [];
      const demoGeminiNodeIds: string[] = [];
      const skippedExecutables: Array<{ nodeId: string; message: string }> =
        [];

      for (const nodeId of executableNodeIds) {
        const prepared = prepareLevelBatchEntry(nodeId);

        if (prepared === "skip") {
          const node = nodeMap.get(nodeId);

          if (node?.data.nodeType === "cropImage") {
            skippedExecutables.push({
              nodeId,
              message: "Crop Image requires a connected uploaded image.",
            });
          } else if (node?.data.nodeType === "geminiPro") {
            skippedExecutables.push({
              nodeId,
              message: "Connected image input is not ready.",
            });
          }

          continue;
        }

        if (prepared === "demo-gemini") {
          demoGeminiNodeIds.push(nodeId);
          continue;
        }

        batchEntries.push(prepared);
      }

      await Promise.all(demoGeminiNodeIds.map((nodeId) => runGeminiNode(nodeId)));
      await runLevelBatch(batchEntries);

      for (const skipped of skippedExecutables) {
        if (finishedNodeIds.has(skipped.nodeId)) {
          continue;
        }

        const node = nodeMap.get(skipped.nodeId);
        const execution = executionByNodeId.get(skipped.nodeId);

        if (!node || !execution) {
          continue;
        }

        await completeNodeFailure(
          skipped.nodeId,
          buildNodeInputRecord(node, edges, outputs, nodes),
          skipped.message,
          new Date(),
        );
      }
    };

    try {
      const levels = computeExecutionLevels(plannedNodeIds, edges);

      logOrchestrator(
        `computed ${levels.length} execution level(s): ${levels
          .map((level, index) => `L${index}=[${level.join(", ")}]`)
          .join(" ")}`,
      );

      for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
        const level = levels[levelIndex] ?? [];

        logOrchestrator(
          `running level ${levelIndex} (${level.length} node(s)): ${level.join(", ")}`,
        );

        await runExecutionLevel(level);
      }

      await markSkippedNodes();
      await settlePlannedExecutions(
        run.executions,
        plannedNodeIds,
        finishedNodeIds,
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
        finishedNodeIds,
        executionByNodeId,
      );

      await finalizeWorkflowRun(payload.runId, "failed", startedAt);
      throw error;
    }
  },
});
