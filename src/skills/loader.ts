/**
 * Skill loader — reads skill files from an agent's workspace, validates
 * frontmatter, computes integrity hashes, and matches skills to tasks.
 *
 * Security invariants:
 * - Files opened read-only (O_RDONLY)
 * - Content hash verified before body injection
 * - Skill selection uses AgentTask type, never raw message content
 * - Skills are human-authored in v1 — agents cannot write to skills/
 */

import { z } from "zod";
import * as yaml from "js-yaml";
import { createHash } from "crypto";
import { readdir, open } from "fs/promises";
import { join, basename } from "path";
import { homedir } from "os";
import type { AgentTask } from "../protocol/types.js";
import { logger } from "../utils/logger.js";

// --- Frontmatter schema ---

export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  triggers: z.array(z.string().min(1)),
  priority: z.number().int().min(0).max(10).optional(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

// --- Skill type ---

export interface Skill {
  frontmatter: SkillFrontmatter;
  body: string;
  hash: string;
  filePath: string;
}

// --- Normalization ---

/**
 * Normalize content for deterministic hashing:
 * 1. Strip BOM
 * 2. Convert \r\n and \r to \n
 * 3. Trim trailing whitespace per line
 */
export function normalizeContent(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

/**
 * Compute SHA-256 hash of normalized content.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// --- Frontmatter parser ---

/**
 * Parse YAML frontmatter from a markdown file using js-yaml with CORE_SCHEMA.
 * CORE_SCHEMA (not FAILSAFE_SCHEMA) is required so numeric values like
 * `priority: 5` are parsed as numbers, not strings.
 * Expects --- delimiters at start and end of frontmatter block.
 */
function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const rawYaml = match[1];
  const body = match[2];

  const parsed = yaml.load(rawYaml, { schema: yaml.CORE_SCHEMA });
  if (parsed === null || parsed === undefined || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return { meta: parsed as Record<string, unknown>, body };
}

// --- Loader ---

/**
 * Load all skills from an agent's skills/ directory.
 * Validates frontmatter with Zod, computes integrity hashes.
 * Files are opened read-only.
 */
export async function loadSkills(agentId: string): Promise<Skill[]> {
  const skillsDir = join(homedir(), ".archon", "agents", agentId, "skills");

  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    // No skills directory — not an error, just no skills
    return [];
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
  const skills: Skill[] = [];

  for (const file of mdFiles) {
    const filePath = join(skillsDir, file);

    // Open read-only (O_RDONLY)
    let rawContent: string;
    try {
      const fd = await open(filePath, "r");
      try {
        const buffer = await fd.readFile("utf-8");
        rawContent = buffer;
      } finally {
        await fd.close();
      }
    } catch (err) {
      logger.warn({ err, filePath }, "Failed to read skill file, skipping");
      continue;
    }

    const normalized = normalizeContent(rawContent);
    const hash = hashContent(normalized);

    const parsed = parseFrontmatter(normalized);
    if (!parsed) {
      logger.warn({ filePath }, "Skill file missing frontmatter (---), skipping");
      continue;
    }

    const result = SkillFrontmatterSchema.safeParse(parsed.meta);
    if (!result.success) {
      logger.warn(
        { filePath, errors: result.error.issues },
        "Skill frontmatter validation failed, skipping"
      );
      continue;
    }

    skills.push({
      frontmatter: result.data,
      body: parsed.body,
      hash,
      filePath,
    });
  }

  if (skills.length > 0) {
    logger.info(
      { agentId, skillCount: skills.length, skills: skills.map((s) => s.frontmatter.name) },
      "Skills loaded"
    );
  }

  return skills;
}

// --- Matcher ---

/**
 * Match a task to the best skill by keyword intersection.
 * Returns the highest-priority match; ties broken by filename (alphabetical).
 */
export function matchSkill(task: AgentTask, skills: Skill[]): Skill | null {
  if (skills.length === 0) return null;

  const inputWords = new Set(
    task.input.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
  );

  let bestSkill: Skill | null = null;
  let bestScore = 0;
  let bestPriority = -Infinity;

  for (const skill of skills) {
    const overlap = skill.frontmatter.triggers.filter((t) =>
      inputWords.has(t.toLowerCase())
    ).length;

    if (overlap === 0) continue;

    const priority = skill.frontmatter.priority ?? 0;

    // Higher priority wins. On equal priority, higher overlap wins.
    // On equal both, alphabetical filename wins (skills array is pre-sorted).
    if (
      priority > bestPriority ||
      (priority === bestPriority && overlap > bestScore)
    ) {
      bestSkill = skill;
      bestScore = overlap;
      bestPriority = priority;
    }
  }

  return bestSkill;
}

// --- Integrity verification ---

/**
 * Re-verify a skill's content hash before injecting its body.
 * Returns the body if hash matches, null if tampered.
 */
export async function verifyAndGetBody(skill: Skill): Promise<string | null> {
  let rawContent: string;
  try {
    const fd = await open(skill.filePath, "r");
    try {
      rawContent = await fd.readFile("utf-8");
    } finally {
      await fd.close();
    }
  } catch {
    logger.error({ filePath: skill.filePath }, "Failed to re-read skill for verification");
    return null;
  }

  const normalized = normalizeContent(rawContent);
  const currentHash = hashContent(normalized);

  if (currentHash !== skill.hash) {
    logger.error(
      { filePath: skill.filePath, expected: skill.hash, actual: currentHash },
      "Skill file hash mismatch — file may have been modified at runtime"
    );
    return null;
  }

  return skill.body;
}
