import { db, closeConnection } from "./connection.js";
import { departments, roles, agents, agentDepartments, permissions } from "./schema.js";
import { logger } from "../utils/logger.js";

async function seed(): Promise<void> {
  logger.info("Seeding database...");

  // --- Departments ---
  await db
    .insert(departments)
    .values([
      { id: "executive", name: "Executive", description: "Company leadership and strategy" },
      { id: "engineering", name: "Engineering", description: "Software development and architecture" },
      { id: "research", name: "Research", description: "Research and experimentation" },
    ])
    .onConflictDoNothing();

  // --- Roles ---
  await db
    .insert(roles)
    .values([
      {
        id: "ceo",
        departmentId: "executive",
        name: "Chief Executive Officer",
        permissions: ["admin", "create_agent", "create_department", "create_meeting", "assign_role"],
      },
      {
        id: "lead_dev",
        departmentId: "engineering",
        name: "Lead Developer",
        permissions: ["create_meeting", "view_agents"],
      },
      {
        id: "researcher",
        departmentId: "research",
        name: "Researcher",
        permissions: ["create_meeting", "view_agents"],
      },
    ])
    .onConflictDoNothing();

  // --- CEO Agent (bootstrap — needs to exist for admin permissions) ---
  await db
    .insert(agents)
    .values({
      id: "ceo",
      displayName: "CEO",
      workspacePath: "~/.archon/agents/ceo",
      modelConfig: { provider: "acpx", backend: "claude-code" },
    })
    .onConflictDoNothing();

  // --- CEO → Executive department ---
  await db
    .insert(agentDepartments)
    .values({
      agentId: "ceo",
      departmentId: "executive",
      roleId: "ceo",
    })
    .onConflictDoNothing();

  // --- CEO admin permissions ---
  const existingPerms = await db.query.permissions.findFirst({
    where: (p, { eq }) => eq(p.agentId, "ceo"),
  });
  if (!existingPerms) {
    await db.insert(permissions).values([
      { agentId: "ceo", resource: "agent:*", action: "admin" },
      { agentId: "ceo", resource: "department:*", action: "admin" },
      { agentId: "ceo", resource: "meeting:*", action: "admin" },
    ]);
  }

  // Other agents are registered via CLI:
  //   npm run archon -- agent add ~/.archon/agents/sherlock ~/.archon/agents/tech-lead ...

  logger.info("Seed complete");
}

seed()
  .then(() => closeConnection())
  .catch((error) => {
    logger.fatal({ error }, "Seed failed");
    process.exit(1);
  });
