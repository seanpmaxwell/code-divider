import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ROOT = path.join(import.meta.dirname, '..', '..');
const LIB_CLI = path.join(ROOT, 'lib', 'cli.js');
const HAS_BUILD = existsSync(LIB_CLI);
const RULE = `// ${'='.repeat(73)} //`;

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

let cwd: string;

/**
 * Run the built CLI as a real process from the temp cwd. `NODE_ENV` is
 * overridden so the child isn't in unit-test mode, where writes are no-ops.
 */
function run(...args: string[]): { status: number | null; out: string } {
  const res = spawnSync(process.execPath, [LIB_CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  return { status: res.status, out: `${res.stdout}${res.stderr}` };
}

/**
 * Write a file under the temp cwd.
 */
async function writeFile(rel: string, content: string): Promise<string> {
  const abs = path.join(cwd, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return abs;
}

// ========================================================================= //
//                                    TESTS                                  //
// ========================================================================= //

// End-to-end tests of the bundled CLI. They need `npm run build` first, so
// they're skipped when `lib/cli.js` doesn't exist (CI builds before testing).
describe.skipIf(!HAS_BUILD)('built CLI (lib/cli.js)', () => {
  beforeEach(async () => {
    cwd = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'code-divider-smoke-')),
    );
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it('should print the package version', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
    );
    const { status, out } = run('--version');
    expect(status).toBe(0);
    expect(out.trim()).toBe(pkg.version);
  });

  it('should rewrite markers on disk', async () => {
    const a = await writeFile('src/a.ts', '// @reg hello\nconst x = 1;\n');
    const { status } = run('src');
    expect(status).toBe(0);
    const content = await fs.readFile(a, 'utf8');
    expect(content.split('\n')[0]).toBe(RULE);
    expect(content).toContain('HELLO');
  });

  it('should leave files untouched on a dry run', async () => {
    const a = await writeFile('a.ts', '// @reg hello\n');
    const { status, out } = run('--dry-run');
    expect(status).toBe(0);
    expect(out).toContain(a);
    expect(await fs.readFile(a, 'utf8')).toBe('// @reg hello\n');
  });

  it('should exit 1 on --check until the files are formatted', async () => {
    await writeFile('a.ts', '// @reg hello\n');
    expect(run('--check').status).toBe(1);
    expect(run().status).toBe(0);
    expect(run('--check').status).toBe(0);
  });

  it('should exit 1 with an error for invalid arguments', () => {
    const { status, out } = run('-h', 'extra');
    expect(status).toBe(1);
    expect(out).toContain('Invalid command-line arguments');
  });
});
