import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/connection.js";
import {
  agents,
  departments,
  roles,
  agentDepartments,
  permissions,
} from "../db/schema.js";
import { generateAgentCard, type AgentCard } from "./agent-card.js";
import { logger } from "../utils/logger.js";

// --- Agent CRUD ---

export interface CreateAgentInput {
  id?: string;
  displayName: string;
  workspacePath: string;
  modelConfig?: Record<string, unknown>;
}

export async function createAgent(input: CreateAgentInput) {
  const id = input.id ?? nanoid(12);
  const [agent] = await db
    .insert(agents)
    .values({
      id,
      displayName: input.displayName,
      workspacePath: input.workspacePath,
      modelConfig: input.modelConfig ?? null,
    })
    .returning();

  logger.info({ agentId: id }, "Agent created");
  return agent;
}

export async function getAgent(agentId: string) {
  return db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });
}

export async function deleteAgent(agentId: string): Promise<boolean> {
  // Remove memberships and permissions first
  await db
    .delete(agentDepartments)
    .where(eq(agentDepartments.agentId, agentId));
  await db.delete(permissions).where(eq(permissions.agentId, agentId));
  const result = await db.delete(agents).where(eq(agents.id, agentId));

  if (result.length > 0) {
    logger.info({ agentId }, "Agent deleted");
    return true;
  }
  return false;
}

// --- Department CRUD ---

export interface CreateDepartmentInput {
  id?: string;
  name: string;
  description?: string;
}

export async function createDepartment(input: CreateDepartmentInput) {
  const id = input.id ?? nanoid(12);
  const [dept] = await db
    .insert(departments)
    .values({
      id,
      name: input.name,
      description: input.description ?? null,
    })
    .returning();

  logger.info({ departmentId: id }, "Department created");
  return dept;
}

export async function getDepartment(departmentId: string) {
  return db.query.departments.findFirst({
    where: eq(departments.id, departmentId),
  });
}

export async function deleteDepartment(
  departmentId: string
): Promise<boolean> {
  const result = await db
    .delete(departments)
    .where(eq(departments.id, departmentId));
  return result.length > 0;
}

// --- Role CRUD ---

export interface CreateRoleInput {
  id?: string;
  departmentId: string;
  name: string;
  permissions?: string[];
}

export async function createRole(input: CreateRoleInput) {
  const id = input.id ?? nanoid(12);
  const [role] = await db
    .insert(roles)
    .values({
      id,
      departmentId: input.departmentId,
      name: input.name,
      permissions: input.permissions ?? [],
    })
    .returning();

  logger.info({ roleId: id }, "Role created");
  return role;
}

// --- Assignments ---

export async function assignAgentToDepartment(
  agentId: string,
  departmentId: string,
  roleId: string
): Promise<void> {
  await db
    .insert(agentDepartments)
    .values({ agentId, departmentId, roleId })
    .onConflictDoNothing();

  // Invalidate cached agent card so it gets regenerated with new role
  await db
    .update(agents)
    .set({ agentCard: null, updatedAt: new Date() })
    .where(eq(agents.id, agentId));

  logger.info({ agentId, departmentId, roleId }, "Agent assigned to department");
}

export async function removeAgentFromDepartment(
  agentId: string,
  departmentId: string
): Promise<void> {
  await db
    .delete(agentDepartments)
    .where(eq(agentDepartments.agentId, agentId));

  // Invalidate cached agent card
  await db
    .update(agents)
    .set({ agentCard: null, updatedAt: new Date() })
    .where(eq(agents.id, agentId));
}

// --- Agent Card ---

export async function refreshAgentCard(
  agentId: string
): Promise<AgentCard | null> {
  return generateAgentCard(agentId);
}
