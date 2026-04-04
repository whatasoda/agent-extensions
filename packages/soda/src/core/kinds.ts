import { z } from "zod";

const kindSchemas = new Map<string, z.ZodType>();

export function registerKind(kind: string, schema: z.ZodType): void {
  kindSchemas.set(kind, schema);
}

export function validateProperties(
  kind: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const schema = kindSchemas.get(kind);
  if (!schema) {
    return props;
  } // Unknown kinds pass through
  return schema.parse(props) as Record<string, unknown>;
}

export function listRegisteredKinds(): string[] {
  return Array.from(kindSchemas.keys());
}

// Built-in kinds
registerKind("memo", z.object({}).passthrough());

registerKind(
  "todo",
  z.object({
    deadline: z.string().datetime().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    status: z.enum(["pending", "in_progress", "done", "cancelled"]).default("pending"),
  }),
);

registerKind(
  "conversation",
  z.object({
    context: z.string(),
    key_points: z.array(z.string()),
    keywords_en: z.array(z.string()).optional(),
    open_questions: z.array(z.string()),
    session_ref: z.string().optional(),
    summary_en: z.string().optional(),
  }),
);

registerKind(
  "idea",
  z.object({
    keywords_en: z.array(z.string()).optional(),
    summary_en: z.string().optional(),
  }),
);

registerKind(
  "decision",
  z.object({
    constraint: z.string().describe("Specific design constraint established"),
    why: z.string().describe("Reasoning behind the constraint"),
    scope: z.string().describe("Where this constraint applies"),
    rejected_alternatives: z
      .array(
        z.object({
          what: z.string().describe("What was considered"),
          why_rejected: z.string().describe("Why it was rejected"),
        }),
      )
      .optional()
      .default([]),
    repo_owner: z.string().optional().describe("Repository owner for scoping"),
    repo_name: z.string().optional().describe("Repository name for scoping"),
    summary_en: z.string().optional(),
    keywords_en: z.array(z.string()).optional(),
  }),
);
