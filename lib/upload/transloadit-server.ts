import { createHmac } from "crypto";

export type TransloaditParamsPayload = {
  auth: {
    key: string;
    expires: string;
  };
  template_id?: string;
  steps?: Record<string, { robot: string }>;
};

export function signTransloaditParams(
  params: TransloaditParamsPayload,
  secret: string,
): { params: string; signature: string } {
  const paramsString = JSON.stringify(params);
  const digest = createHmac("sha384", secret.trim())
    .update(Buffer.from(paramsString, "utf-8"))
    .digest("hex");

  // Transloadit expects the algorithm prefix; without it, SHA-1 is assumed.
  return { params: paramsString, signature: `sha384:${digest}` };
}

export function buildTransloaditParamsPayload(): TransloaditParamsPayload {
  const authKey = process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY;

  if (!authKey) {
    throw new Error("Transloadit auth key is not configured.");
  }

  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const payload: TransloaditParamsPayload = {
    auth: {
      key: authKey,
      expires,
    },
  };

  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID?.trim();

  if (templateId) {
    payload.template_id = templateId;
  } else {
    payload.steps = {
      ":original": {
        robot: "/upload/handle",
      },
    };
  }

  return payload;
}
