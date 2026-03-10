/**
 * Permission-filtered agent discovery.
 * A2A-inspired: agents advertise capabilities via Agent Cards,
 * and other agents can discover them based on permissions.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "../db/connection.js";
import { agents, agentDepartments } from "../db/schema.js";
import { getAgentCard, type AgentCard } from "./agent-card.js";
import { hasPermission } from "../hub/permissions.js";

export interface DiscoveryFilter {
  departmentId?: string;
}

/**
 * List agents visible to the requesting agent, filtered by permissions.
 * Agents with "agent:*" admin permission see all agents.
 * Otherwise, agents see themselves + agents in shared departments.
 */
export async function discoverAgents(
  requestingAgentId: string,
  filter?: DiscoveryFilter
): Promise<AgentCard[]> {
  const canViewAll = await hasPermission(
    requestingAgentId,
    "agent:*",
    "admin"
  );

  let agentIds: string[];

  if (canViewAll) {
    const allAgents = await db.select({ id: agents.id }).from(agents);
    agentIds = allAgents.map((a) => a.id);
  } else {
    // Find departments this agent belongs to
    const myDepts = await db
      .select({ departmentId: agentDepartments.departmentId })
      .from(agentDepartments)
      .where(eq(agentDepartments.agentId, requestingAgentId));

    const deptIds = myDepts.map((d) => d.departmentId);

    if (deptIds.length === 0) {
      agentIds = [requestingAgentId];
    } else {
      // All agents in the same departments
      const coworkers = await db
        .selectDistinct({ agentId: agentDepartments.agentId })
        .from(agentDepartments)
        .where(inArray(agentDepartments.departmentId, deptIds));

      agentIds = [
        ...new Set([
          requestingAgentId,
          ...coworkers.map((c) => c.agentId),
        ]),
      ];
    }
  }

  // Apply department filter
  if (filter?.departmentId) {
    const deptMembers = await db
      .select({ agentId: agentDepartments.agentId })
      .from(agentDepartments)
      .where(eq(agentDepartments.departmentId, filter.departmentId));

    const deptMemberIds = new Set(deptMembers.map((m) => m.agentId));
    agentIds = agentIds.filter((id) => deptMemberIds.has(id));
  }

  // Build agent cards
  const cards: AgentCard[] = [];
  for (const id of agentIds) {
    const card = await getAgentCard(id);
    if (card) cards.push(card);
  }

  return cards;
}
