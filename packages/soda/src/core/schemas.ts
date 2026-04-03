import { z } from "zod";

export const CreateNodeInput = z.object({
  body: z.string().default("").describe("The text body of the node"),
  kind: z.string().min(1).describe("The kind/type of the node"),
  properties: z
    .record(z.string(), z.unknown())
    .default({})
    .describe("Structured properties for the node"),
  tags: z.array(z.string()).optional().describe("Tags to apply to the node"),
});

export const UpdateNodeInput = z.object({
  body: z.string().optional().describe("New body text"),
  id: z.string().length(26).describe("The node ID to update"),
  kind: z.string().optional().describe("New kind for the node"),
  properties: z.record(z.string(), z.unknown()).optional().describe("Updated properties"),
});

export const SearchNodesInput = z.object({
  kind: z.string().optional().describe("Filter by node kind"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results (default 20)"),
  offset: z.number().int().min(0).default(0).describe("Offset for pagination (default 0)"),
  query: z.string().optional().describe("Full-text search query"),
  tags: z.array(z.string()).optional().describe("Filter by tags"),
});

export const GetLinksInput = z.object({
  direction: z
    .enum(["from", "to", "both"])
    .default("both")
    .describe("Direction of links to retrieve"),
  node_id: z.string().length(26).describe("The node ID to get links for"),
});

export const CreateLinkInput = z.object({
  from_id: z.string().length(26).describe("The source node ID"),
  link_type: z.string().min(1).describe("The type of link"),
  to_id: z.string().length(26).describe("The target node ID"),
});

export const TagsInput = z.object({
  node_id: z.string().length(26).describe("The node ID to add/remove tags"),
  tags: z.array(z.string().min(1)).min(1).describe("Tags to add or remove"),
});

export const NodeIdInput = z.object({
  id: z.string().length(26).describe("The node ID"),
});

export const DeleteLinkInput = z.object({
  from_id: z.string().length(26).describe("The source node ID"),
  link_type: z.string().min(1).describe("The type of link"),
  to_id: z.string().length(26).describe("The target node ID"),
});
