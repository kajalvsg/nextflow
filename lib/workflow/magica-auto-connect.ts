import type { Connection, Node } from "reactflow";
import { REQUEST_INPUTS_NODE_ID } from "@/lib/workflow/canvas";
import {
  createRequestFieldId,
  createRequestInputFieldWithId,
  createUniqueRequestFieldId,
  normalizeRequestInputsConfig,
  serializeRequestInputsConfig,
  type RequestFieldType,
} from "@/lib/workflow/request-inputs-fields";
import type {
  RequestInputField,
  RequestInputsConfig,
  WorkflowNodeData,
} from "@/types/workflow-canvas";

export const GEMINI_MAGICA_TARGET_HANDLES = [
  "prompt",
  "system_prompt",
  "image_vision",
  "video",
  "audio",
  "file",
  "json_mode",
] as const;

export type GeminiMagicaTargetHandle =
  (typeof GEMINI_MAGICA_TARGET_HANDLES)[number];

const UNSUPPORTED_TOAST: Partial<Record<GeminiMagicaTargetHandle, string>> = {
  video: "Video input fields are not supported yet.",
  audio: "Audio input fields are not supported yet.",
  file: "File input fields are not supported yet.",
  json_mode: "JSON Mode external input is not supported yet.",
};

export function isGeminiMagicaTargetHandle(
  handle: string,
): handle is GeminiMagicaTargetHandle {
  return (GEMINI_MAGICA_TARGET_HANDLES as readonly string[]).includes(handle);
}

export function getUnsupportedMagicaToast(
  handle: GeminiMagicaTargetHandle,
): string | null {
  return UNSUPPORTED_TOAST[handle] ?? null;
}

type SupportedMagicaHandle = "prompt" | "system_prompt" | "image_vision";

function fieldSpecForHandle(
  targetHandle: SupportedMagicaHandle,
): { type: RequestFieldType; idBase: string } {
  switch (targetHandle) {
    case "prompt":
      return { type: "text_field", idBase: "prompt" };
    case "system_prompt":
      return { type: "text_field", idBase: "system_prompt" };
    case "image_vision":
      return { type: "image_field", idBase: "image_field" };
  }
}

export type MagicaAutoConnectPlan = {
  requestInputsNodeId: string;
  newField: RequestInputField;
  connection: Connection;
  nextRequestInputsConfig: RequestInputsConfig;
};

export type MagicaAutoConnectResult =
  | { kind: "plan"; plan: MagicaAutoConnectPlan }
  | { kind: "unsupported" }
  | { kind: "no_request_inputs" }
  | { kind: "not_magica" };

export function planMagicaAutoConnect(
  targetNodeId: string,
  targetHandle: string,
  nodes: Node<WorkflowNodeData>[],
): MagicaAutoConnectResult {
  if (!isGeminiMagicaTargetHandle(targetHandle)) {
    return { kind: "not_magica" };
  }

  if (getUnsupportedMagicaToast(targetHandle)) {
    return { kind: "unsupported" };
  }

  const supportedHandle = targetHandle as SupportedMagicaHandle;
  const spec = fieldSpecForHandle(supportedHandle);
  const requestInputs = nodes.find(
    (node) =>
      node.data.nodeType === "requestInputs" ||
      node.id === REQUEST_INPUTS_NODE_ID,
  );

  if (!requestInputs) {
    return { kind: "no_request_inputs" };
  }
  const currentConfig = normalizeRequestInputsConfig(requestInputs.data.config);
  const existingIds = currentConfig.fields.map((field) => field.id);

  const fieldId =
    targetHandle === "image_vision"
      ? createRequestFieldId(spec.type, existingIds)
      : createUniqueRequestFieldId(spec.idBase, existingIds);

  const newField = createRequestInputFieldWithId(spec.type, fieldId);
  const nextRequestInputsConfig = serializeRequestInputsConfig({
    fields: [...currentConfig.fields, newField],
  });

  return {
    kind: "plan",
    plan: {
      requestInputsNodeId: requestInputs.id,
      newField,
      nextRequestInputsConfig,
      connection: {
        source: requestInputs.id,
        target: targetNodeId,
        sourceHandle: newField.id,
        targetHandle,
      },
    },
  };
}

export function applyMagicaAutoConnectToNodes(
  nodes: Node<WorkflowNodeData>[],
  plan: MagicaAutoConnectPlan,
): Node<WorkflowNodeData>[] {
  return nodes.map((node) =>
    node.id === plan.requestInputsNodeId
      ? {
          ...node,
          data: {
            ...node.data,
            config: plan.nextRequestInputsConfig,
          },
        }
      : node,
  );
}
