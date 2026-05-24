"use server";

import { auth } from "@clerk/nextjs/server";
import { describeTransloaditResponseShape } from "@/lib/upload/transloadit-response";
import {
  buildTransloaditParamsPayload,
  signTransloaditParams,
} from "@/lib/upload/transloadit-server";

export type TransloaditUploadParams = {
  params: string;
  signature: string;
};

async function requireUserId(): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

export async function createTransloaditUploadParams(): Promise<TransloaditUploadParams> {
  await requireUserId();

  const secret = process.env.TRANSLOADIT_AUTH_SECRET;

  if (!secret) {
    throw new Error("Transloadit is not configured on the server.");
  }

  const payload = buildTransloaditParamsPayload();

  return signTransloaditParams(payload, secret);
}

export async function logTransloaditParseFailure(
  responseShape: unknown,
): Promise<void> {
  await requireUserId();

  console.error(
    "[transloadit-upload] Missing file URL. Response shape:",
    JSON.stringify(describeTransloaditResponseShape(responseShape), null, 2),
  );
}
