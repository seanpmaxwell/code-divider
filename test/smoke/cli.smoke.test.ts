import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  JS_RULE,
  makeTmpDir,
  writeFile as writeFile_,
} from '@test/_common/utils';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ROOT = path.join(import.meta.dirname, '..', '..');
const LIB_CLI = path.join(ROOT, 'lib', 'cli.js');
const HAS_BUILD = existsSync(LIB_CLI);

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

let cwd: string;

/**
 * Run the built CLI as a real process from the temp cwd.
 */
function run(...args: string[]): { status: number | null; out: string } {
  const res = spawnSync(process.execPath, [LIB_CLI, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return { status: res.status, out: `${res.stdout}${res.stderr}` };
}

/**
 * Write a file under the temp cwd.
 */
function writeFile(rel: string, content: string): Promise<string> {
  return writeFile_(cwd, rel, content);
}

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

// End-to-end tests of the bundled CLI. They need `npm run build` first, so
// they're skipped when `lib/cli.js` doesn't exist (CI builds before testing).
describe.skipIf(!HAS_BUILD)('built CLI (lib/cli.js)', () => {
  beforeEach(async () => {
    cwd = await makeTmpDir('smoke');
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
    const { status } = run('--path', 'src');
    expect(status).toBe(0);
    const content = await fs.readFile(a, 'utf8');
    expect(content.split('\n')[0]).toBe(JS_RULE);
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

  it('should bring existing dividers up to date with a config file', async () => {
    const a = await writeFile('a.ts', '// @sec hello\n');
    expect(run().status).toBe(0);
    expect((await fs.readFile(a, 'utf8')).trimEnd()).toHaveLength(79);
    await writeFile(
      'code-divider.config.json',
      '{ "$schema": "ignored", "All": { "CharacterLimit": 50 } }\n',
    );
    expect(run('--check').status).toBe(1);
    expect(run().status).toBe(0);
    expect((await fs.readFile(a, 'utf8')).trimEnd()).toHaveLength(50);
  });

  it('should produce a config with --init that the next run accepts', async () => {
    expect(run('--init').status).toBe(0);
    const config = await fs.readFile(
      path.join(cwd, 'code-divider.config.json'),
      'utf8',
    );
    expect(config).toContain('"$schema": "https://unpkg.com/code-divider@');
    await writeFile('a.ts', '// @reg hello\n');
    const { status, out } = run();
    expect(status).toBe(0);
    expect(out).toContain('1 file/s updated');
  });

  it('should exit 1 with a one-line error (no stack trace) for invalid arguments', () => {
    const { status, out } = run('-h', '--dry-run');
    expect(status).toBe(1);
    expect(out).toContain('code-divider: Invalid command-line arguments');
    expect(out).not.toMatch(/\n\s+at /);
  });

  it('should exit 1 and point to --path for a bare path', async () => {
    const a = await writeFile('src/a.ts', '// @reg hello\n');
    const { status, out } = run('src');
    expect(status).toBe(1);
    expect(out).toContain('Pass the path with --path');
    expect(await fs.readFile(a, 'utf8')).toBe('// @reg hello\n');
  });

  it('should exit 1 with a one-line error for an invalid config file', async () => {
    await writeFile('a.ts', '// @reg hello\n');
    await writeFile(
      'code-divider.config.json',
      '{ "All": { "CharacterLimit": "x" } }\n',
    );
    const { status, out } = run();
    expect(status).toBe(1);
    expect(out).toContain('CharacterLimit');
    expect(out).not.toMatch(/\n\s+at /);
  });
});
