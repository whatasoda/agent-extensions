// Structured-output schemas reject validation keywords: `uniqueItems`, `minItems`, and `minLength`
// all return HTTP 400 from the model provider. Constraints live in the descriptions here and are
// enforced by parseCodexResult() instead.
export const HANDOFF_OUTPUT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["title", "slug", "keywords_en", "tags", "next_actions", "body_markdown"],
  properties: {
    title: {
      type: "string",
      description: "One-line summary of the workstream, used as the document H1.",
    },
    slug: {
      type: "string",
      description: "Kebab-case ASCII identifier, at most 50 characters.",
    },
    keywords_en: {
      type: "array",
      items: { type: "string" },
      description: "3-7 distinct English search keywords.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description:
        "Up to 8 additional knowledge-graph tags, lowercase, optionally namespaced (topic:foo). May be empty.",
    },
    next_actions: {
      type: "array",
      items: { type: "string" },
      description:
        "At least one concrete next step, mirroring the Next Actions section of the document.",
    },
    body_markdown: {
      type: "string",
      description: "The full handoff document as rich Markdown.",
    },
  },
} as const;

export const HANDOFF_REVIEW_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["verdict", "issues", "notes"],
  properties: {
    verdict: {
      type: "string",
      enum: ["accept", "revise"],
      description: "`accept` only when no issue would mislead or block the next session.",
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "issue", "fix"],
        properties: {
          severity: {
            type: "string",
            enum: ["blocker", "improve"],
            description:
              "`blocker` only when the next session would act wrongly because of it; `improve` for everything else, including harmless factual imprecision.",
          },
          issue: { type: "string", description: "What is wrong, with the evidence that shows it." },
          fix: { type: "string", description: "The concrete correction the author should apply." },
        },
      },
      description: "Empty when the verdict is `accept`.",
    },
    notes: {
      type: "string",
      description: "What was checked and what could not be checked. May be empty.",
    },
  },
} as const;
