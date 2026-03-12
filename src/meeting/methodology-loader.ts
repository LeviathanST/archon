/**
 * Loads methodology definitions from ~/.archon/methodologies/ or returns the built-in default.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { Methodology } from "./methodology.js";
import { DEFAULT_METHODOLOGY, parseMethodology } from "./methodology-parser.js";

const METHODOLOGIES_DIR = join(homedir(), ".archon", "methodologies");

// Cache parsed methodologies
const cache = new Map<string, Methodology>();

export function getDefaultMethodology(): Methodology {
  return DEFAULT_METHODOLOGY;
}

export async function loadMethodology(id: string): Promise<Methodology> {
  if (id === "general") return DEFAULT_METHODOLOGY;

  const cached = cache.get(id);
  if (cached) return cached;

  const filePath = join(METHODOLOGIES_DIR, `${id}.md`);
  const markdown = await readFile(filePath, "utf-8");
  const methodology = parseMethodology(id, markdown);

  cache.set(id, methodology);
  return methodology;
}

/** Clear the methodology cache (for testing). */
export function clearMethodologyCache(): void {
  cache.clear();
}
