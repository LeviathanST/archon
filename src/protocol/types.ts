import { z } from "zod";

/**
 * AgentTask — the input type for skill matching.
 * Defined here in the protocol layer so the skill loader cannot accept
 * raw inbound messages — TypeScript enforces the trust boundary at compile time.
 */
export const AgentTaskSchema = z.object({
  agentId: z.string(),
  input: z.string(),
});

export type AgentTask = z.infer<typeof AgentTaskSchema>;
