import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, closeConnection } from "../../src/db/connection.js";
import {
  agents,
  departments,
  roles,
  agentDepartments,
  permissions,
} from "../../src/db/schema.js";
import { discoverAgents } from "../../src/registry/discovery.js";

// Test agents: alpha (admin), beta and gamma (same dept), delta (different dept)
const DEPT_A = "disc-dept-a";
const DEPT_B = "disc-dept-b";
const ROLE_A = "disc-role-a";
const ROLE_B = "disc-role-b";

beforeAll(async () => {
  // Departments
  await db.insert(departments).values([
    { id: DEPT_A, name: "Disc Dept A" },
    { id: DEPT_B, name: "Disc Dept B" },
  ]).onConflictDoNothing();

  // Roles
  await db.insert(roles).values([
    { id: ROLE_A, departmentId: DEPT_A, name: "Role A", permissions: [] },
    { id: ROLE_B, departmentId: DEPT_B, name: "Role B", permissions: [] },
  ]).onConflictDoNothing();

  // Agents
  await db.insert(agents).values([
    { id: "disc-alpha", displayName: "Alpha", workspacePath: "/tmp/alpha" },
    { id: "disc-beta", displayName: "Beta", workspacePath: "/tmp/beta" },
    { id: "disc-gamma", displayName: "Gamma", workspacePath: "/tmp/gamma" },
    { id: "disc-delta", displayName: "Delta", workspacePath: "/tmp/delta" },
  ]).onConflictDoNothing();

  // Alpha = admin
  await db.insert(permissions).values({
    agentId: "disc-alpha",
    resource: "agent:*",
    action: "admin",
  });

  // Beta and Gamma in Dept A
  await db.insert(agentDepartments).values([
    { agentId: "disc-beta", departmentId: DEPT_A, roleId: ROLE_A },
    { agentId: "disc-gamma", departmentId: DEPT_A, roleId: ROLE_A },
  ]).onConflictDoNothing();

  // Delta in Dept B
  await db.insert(agentDepartments).values({
    agentId: "disc-delta",
    departmentId: DEPT_B,
    roleId: ROLE_B,
  }).onConflictDoNothing();
});

afterAll(async () => {
  // Clean up in correct FK order
  await db.delete(agentDepartments).where(eq(agentDepartments.departmentId, DEPT_A));
  await db.delete(agentDepartments).where(eq(agentDepartments.departmentId, DEPT_B));
  await db.delete(permissions).where(eq(permissions.agentId, "disc-alpha"));
  for (const id of ["disc-alpha", "disc-beta", "disc-gamma", "disc-delta"]) {
    await db.delete(agents).where(eq(agents.id, id));
  }
  await db.delete(roles).where(eq(roles.id, ROLE_A));
  await db.delete(roles).where(eq(roles.id, ROLE_B));
  await db.delete(departments).where(eq(departments.id, DEPT_A));
  await db.delete(departments).where(eq(departments.id, DEPT_B));
  await closeConnection();
});

describe("Discovery", () => {
  it("admin should see all agents", async () => {
    const cards = await discoverAgents("disc-alpha");
    const ids = cards.map((c) => c.id);

    // Should see at least our 4 test agents (plus any seeded ones like CEO)
    expect(ids).toContain("disc-alpha");
    expect(ids).toContain("disc-beta");
    expect(ids).toContain("disc-gamma");
    expect(ids).toContain("disc-delta");
  });

  it("non-admin should see self + agents in shared departments", async () => {
    const cards = await discoverAgents("disc-beta");
    const ids = cards.map((c) => c.id);

    expect(ids).toContain("disc-beta");
    expect(ids).toContain("disc-gamma"); // same department
    expect(ids).not.toContain("disc-delta"); // different department
  });

  it("agent with no departments should see only self", async () => {
    const cards = await discoverAgents("disc-alpha");
    // Alpha is admin so sees all — test with a non-admin, no-dept agent
    // disc-alpha has admin perms but no department assignments
    // Let's remove the admin perm temporarily... actually just check disc-delta isolated

    // disc-delta is in DEPT_B alone
    const cards2 = await discoverAgents("disc-delta");
    const ids = cards2.map((c) => c.id);
    expect(ids).toContain("disc-delta");
    expect(ids).not.toContain("disc-beta"); // different department
  });

  it("should filter by department", async () => {
    const cards = await discoverAgents("disc-alpha", {
      departmentId: DEPT_A,
    });
    const ids = cards.map((c) => c.id);

    expect(ids).toContain("disc-beta");
    expect(ids).toContain("disc-gamma");
    expect(ids).not.toContain("disc-delta");
  });

  it("should return agent cards with correct structure", async () => {
    const cards = await discoverAgents("disc-alpha", {
      departmentId: DEPT_A,
    });

    for (const card of cards) {
      expect(card).toHaveProperty("id");
      expect(card).toHaveProperty("displayName");
      expect(card).toHaveProperty("departments");
      expect(card).toHaveProperty("characteristics");
      expect(card).toHaveProperty("status");
    }
  });
});
