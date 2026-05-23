-- NextFlow initial schema (matches prisma/schema.prisma)
-- Applied by: npm run db:push

CREATE TABLE IF NOT EXISTS "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Workflow_userId_idx" ON "Workflow"("userId");

CREATE TABLE IF NOT EXISTS "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkflowRun_workflowId_fkey"
        FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WorkflowRun_workflowId_idx" ON "WorkflowRun"("workflowId");
CREATE INDEX IF NOT EXISTS "WorkflowRun_userId_idx" ON "WorkflowRun"("userId");

CREATE TABLE IF NOT EXISTS "NodeExecution" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    CONSTRAINT "NodeExecution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NodeExecution_runId_fkey"
        FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NodeExecution_runId_idx" ON "NodeExecution"("runId");
CREATE INDEX IF NOT EXISTS "NodeExecution_nodeId_idx" ON "NodeExecution"("nodeId");

-- Prisma migration tracking (so `prisma migrate` knows baseline later)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
