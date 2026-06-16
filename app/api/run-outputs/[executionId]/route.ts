import { auth } from "@clerk/nextjs/server";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db, ensureDbReady } from "@/lib/db";
import { getRunOutputFilePath } from "@/lib/workflow/execution/compact-run-output";

type RouteContext = {
  params: Promise<{ executionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { executionId } = await context.params;

  if (!/^c[a-z0-9]{20,}$/i.test(executionId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  await ensureDbReady();

  const execution = await db.nodeExecution.findFirst({
    where: {
      id: executionId,
      run: { userId },
    },
    select: { id: true },
  });

  if (!execution) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const bytes = await readFile(getRunOutputFilePath(executionId));

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
