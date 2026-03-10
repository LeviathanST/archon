import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, closeConnection } from "../../src/db/connection.js";
import { agents, permissions } from "../../src/db/schema.js";
import { hasPermission, grantPermission } from "../../src/hub/permissions.js";

const TEST_AGENT = "perm-test-agent";

beforeAll(async () => {
  await db.insert(agents).values({
    id: TEST_AGENT,
    displayName: "Perm Test Agent",
    workspacePath: "/tmp/perm-test",
  }).onConflictDoNothing();

  // Grant some permissions
  await db.insert(permissions).values([
    { agentId: TEST_AGENT, resource: "meeting:*", action: "create" },
    { agentId: TEST_AGENT, resource: "agent:vex", action: "view" },
  ]);
});

afterAll(async () => {
  await db.delete(permissions).where(eq(permissions.agentId, TEST_AGENT));
  await db.delete(agents).where(eq(agents.id, TEST_AGENT));
  await closeConnection();
});

describe("Permissions", () => {
  it("should match exact permission", async () => {
    const result = await hasPermission(TEST_AGENT, "agent:vex", "view");
    expect(result).toBe(true);
  });

  it("should match wildcard resource", async () => {
    const result = await hasPermission(TEST_AGENT, "meeting:abc123", "create");
    expect(result).toBe(true);
  });

  it("should reject missing permission", async () => {
    const result = await hasPermission(TEST_AGENT, "agent:vex", "admin");
    expect(result).toBe(false);
  });

  it("should reject non-matching resource", async () => {
    const result = await hasPermission(TEST_AGENT, "department:eng", "view");
    expect(result).toBe(false);
  });

  it("should grant new permission via grantPermission", async () => {
    await grantPermission(TEST_AGENT, "department:eng", "view");
    const result = await hasPermission(TEST_AGENT, "department:eng", "view");
    expect(result).toBe(true);
  });

  it("should not duplicate permissions on re-grant", async () => {
    await grantPermission(TEST_AGENT, "department:eng", "view");
    await grantPermission(TEST_AGENT, "department:eng", "view");

    const perms = await db.query.permissions.findMany({
      where: eq(permissions.agentId, TEST_AGENT),
    });

    const matches = perms.filter(
      (p) => p.resource === "department:eng" && p.action === "view"
    );
    expect(matches.length).toBe(1);
  });
});
