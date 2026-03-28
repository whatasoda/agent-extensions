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
    decisions: z.array(z.string()),
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
    chosen: z.string().describe("The selected option"),
    keywords_en: z.array(z.string()).optional(),
    options: z.array(z.string()).describe("Considered alternatives"),
    rationale: z.string().describe("Why this was chosen"),
    summary_en: z.string().optional(),
  }),
);
