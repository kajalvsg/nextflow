import {
  defaultImageFieldState,
  serializeImageFieldState,
} from "@/lib/workflow/node-defaults";
import type {
  ImageFieldState,
  RequestInputField,
  RequestInputsConfig,
} from "@/types/workflow-canvas";

export type RequestFieldType = RequestInputField["type"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function slugifyRequestFieldLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug.length > 0 ? slug : "field";
}

export function createRequestFieldId(
  type: RequestFieldType,
  existingIds: Iterable<string>,
): string {
  const used = new Set(existingIds);
  const base = type;

  if (!used.has(base)) {
    return base;
  }

  let index = 2;

  while (used.has(`${base}_${index}`)) {
    index += 1;
  }

  return `${base}_${index}`;
}

export function fieldIdFromLabel(
  label: string,
  type: RequestFieldType,
  existingIds: Iterable<string>,
  currentId?: string,
): string {
  const used = new Set(existingIds);
  if (currentId) {
    used.delete(currentId);
  }

  let candidate = slugifyRequestFieldLabel(label);

  if (!candidate) {
    candidate = type;
  }

  if (!used.has(candidate)) {
    return candidate;
  }

  let index = 2;

  while (used.has(`${candidate}_${index}`)) {
    index += 1;
  }

  return `${candidate}_${index}`;
}

export function createUniqueRequestFieldId(
  base: string,
  existingIds: Iterable<string>,
): string {
  const used = new Set(existingIds);

  if (!used.has(base)) {
    return base;
  }

  let index = 2;

  while (used.has(`${base}_${index}`)) {
    index += 1;
  }

  return `${base}_${index}`;
}

export function createRequestInputFieldWithId(
  type: RequestFieldType,
  id: string,
  label?: string,
): RequestInputField {
  return {
    id,
    label: label ?? id,
    type,
    ...(type === "text_field"
      ? { textValue: "" }
      : { imageValue: defaultImageFieldState() }),
  };
}

export function createRequestInputField(
  type: RequestFieldType,
  existingIds: Iterable<string>,
  label?: string,
): RequestInputField {
  const id = createRequestFieldId(type, existingIds);

  return createRequestInputFieldWithId(type, id, label ?? id);
}

export function getImageFieldExecutionState(
  field: RequestInputField,
): ImageFieldState {
  if (field.type !== "image_field") {
    return defaultImageFieldState();
  }

  return serializeImageFieldState({
    ...(field.imageValue ?? {}),
    value: field.value ?? field.imageValue?.value,
    dataUrl: field.dataUrl ?? field.imageValue?.dataUrl,
    fileName: field.fileName ?? field.imageValue?.fileName,
    mimeType: field.mimeType ?? field.imageValue?.mimeType,
    meta: field.meta ?? field.imageValue?.meta,
  });
}

export function getImageFieldFromConfigFields(
  config: unknown,
  fieldId: string,
): ImageFieldState | null {
  if (!isRecord(config) || !Array.isArray(config.fields)) {
    return null;
  }

  for (const item of config.fields) {
    if (!isRecord(item) || item.id !== fieldId || item.type !== "image_field") {
      continue;
    }

    const state = serializeImageFieldState(mergeImageFieldRecord(item));

    if (state.dataUrl || state.value || state.fileUrl) {
      return state;
    }
  }

  return null;
}

function mergeImageFieldRecord(value: Record<string, unknown>): Record<string, unknown> {
  const nested = value.imageValue ?? value.imageField;
  const base: Record<string, unknown> = isRecord(nested) ? { ...nested } : {};

  if (typeof value.value === "string") {
    base.value = value.value;
  }

  if (typeof value.dataUrl === "string") {
    base.dataUrl = value.dataUrl;
  }

  if (typeof value.fileName === "string") {
    base.fileName = value.fileName;
  }

  if (typeof value.mimeType === "string") {
    base.mimeType = value.mimeType;
  }

  if (isRecord(value.meta)) {
    base.meta = {
      ...(isRecord(base.meta) ? (base.meta as Record<string, unknown>) : {}),
      ...value.meta,
    };
  }

  return base;
}

function parseImageFieldState(value: unknown): ImageFieldState {
  if (!isRecord(value)) {
    return defaultImageFieldState();
  }

  return serializeImageFieldState(mergeImageFieldRecord(value));
}

function parseRequestInputField(value: unknown): RequestInputField | null {
  if (!isRecord(value)) {
    return null;
  }

  const type =
    value.type === "text_field" || value.type === "image_field"
      ? value.type
      : null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";

  if (!type || !id) {
    return null;
  }

  if (type === "text_field") {
    return {
      id,
      label: label || id,
      type,
      textValue: typeof value.textValue === "string" ? value.textValue : "",
    };
  }

  return {
    id,
    label: label || id,
    type,
    imageValue: parseImageFieldState(mergeImageFieldRecord(value)),
  };
}

export function defaultRequestInputsFields(): RequestInputField[] {
  return [
    createRequestInputField("text_field", [], "text_field"),
    createRequestInputField("image_field", ["text_field"], "image_field"),
  ];
}

export function defaultRequestInputsConfig(): RequestInputsConfig {
  return {
    fields: defaultRequestInputsFields(),
  };
}

export function normalizeRequestInputsConfig(
  value: unknown,
): RequestInputsConfig {
  if (isRecord(value) && Array.isArray(value.fields)) {
    const fields = value.fields
      .map(parseRequestInputField)
      .filter((field): field is RequestInputField => field !== null);

    if (fields.length > 0) {
      const legacyText =
        typeof value.textField === "string" ? value.textField : null;
      const legacyImage = isRecord(value.imageField)
        ? parseImageFieldState(value.imageField)
        : null;

      const merged = fields.map((field) => {
        if (
          field.type === "text_field" &&
          legacyText &&
          !(field.textValue ?? "").trim()
        ) {
          return { ...field, textValue: legacyText };
        }

        if (
          field.type === "image_field" &&
          legacyImage?.fileUrl &&
          !field.imageValue?.fileUrl
        ) {
          return { ...field, imageValue: legacyImage };
        }

        return field;
      });

      return { fields: merged };
    }
  }

  if (isRecord(value)) {
    const fields: RequestInputField[] = [];

    if ("textField" in value || "imageField" in value) {
      fields.push({
        id: "text_field",
        label: "text_field",
        type: "text_field",
        textValue:
          typeof value.textField === "string" ? value.textField : "",
      });
      fields.push({
        id: "image_field",
        label: "image_field",
        type: "image_field",
        imageValue: parseImageFieldState(value.imageField),
      });

      return { fields };
    }
  }

  return defaultRequestInputsConfig();
}

export function serializeRequestInputsConfig(
  config: RequestInputsConfig,
): RequestInputsConfig {
  return {
    fields: config.fields.map((field) => {
      if (field.type === "text_field") {
        return {
          id: field.id,
          label: field.label,
          type: field.type,
          textValue: field.textValue ?? "",
        };
      }

      const imageValue = getImageFieldExecutionState(field);

      return {
        id: field.id,
        label: field.label,
        type: field.type,
        value: imageValue.value,
        dataUrl: imageValue.dataUrl,
        fileName: imageValue.fileName,
        mimeType: imageValue.mimeType,
        meta: {
          dataUrl: imageValue.dataUrl ?? null,
          fileUrl: imageValue.fileUrl ?? null,
          fileName: imageValue.fileName ?? null,
          mimeType: imageValue.mimeType ?? null,
        },
        imageValue,
      };
    }),
  };
}

export function getRequestInputField(
  config: RequestInputsConfig,
  handleId: string,
): RequestInputField | undefined {
  return config.fields.find((field) => field.id === handleId);
}

export function isRequestInputsTextHandle(
  config: RequestInputsConfig,
  handleId: string,
): boolean {
  return getRequestInputField(config, handleId)?.type === "text_field";
}

export function isRequestInputsImageHandle(
  config: RequestInputsConfig,
  handleId: string,
): boolean {
  return getRequestInputField(config, handleId)?.type === "image_field";
}

export function findFirstRequestFieldId(
  config: RequestInputsConfig,
  type: RequestFieldType,
): string | null {
  return config.fields.find((field) => field.type === type)?.id ?? null;
}
