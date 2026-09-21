import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import type { ILogger } from '@logger';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// A rule line with the default JavaScript settings: limit 79, filler "=",
// bookends "// " / " //".
export const JS_RULE = `// ${'='.repeat(73)} //`;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Create a fresh temp directory. The path is `realpath`ed so it matches what
 * the code under test produces (on macOS, `/var` -> `/private/var`).
 */
export async function makeTmpDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), `code-divider-${prefix}-`),
  );
  return fs.realpath(dir);
}

/**
 * Write a file under `dir`, creating parent folders. Returns the absolute path.
 */
export async function writeFile(
  dir: string,
  rel: string,
  content: string,
): Promise<string> {
  const abs = path.join(dir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return abs;
}

/**
 * Create a file with placeholder content (the content doesn't matter).
 */
export async function mkFile(absPath: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, 'TEST_GENERATED_FILE', 'utf8');
}

/**
 * Create a logger from a partial; whatever is missing ignores its messages.
 */
export function createLogger(partial: Partial<ILogger>): ILogger {
  return {
    info: () => {},
    warn: () => {},
    ...partial,
  };
}
