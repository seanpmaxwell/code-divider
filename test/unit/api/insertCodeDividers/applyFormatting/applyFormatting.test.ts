import logger, { type ILogger } from '@logger';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import applyFormatting from '@src/api/insertCodeDividers/applyFormatting/applyFormatting';
import configureSettings from '@src/api/insertCodeDividers/configureSettings/configureSettings';

import uFile, { FilePathDTO } from '@utilm/uFile';

import type {
  ConfiguredLangSettings,
  ExtensionsMap,
} from '@common/types/settings';
import RunContext from '@common/utils/fns/RunContext';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Default JavaScript settings: limit 79, filler "=", bookends "// " / " //".
const RULE = `// ${'='.repeat(73)} //`;

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

let base: string; // holds the default settings lookup
let tmp: string; // fresh per test
let defaultMap: ExtensionsMap;
let write: ReturnType<typeof vi.spyOn>;
let warn: Mock<ILogger['warn']>;

interface RunOptions {
  isDryRun?: boolean;
  // Overrides applied to the `.ts` settings
  ts?: Partial<ConfiguredLangSettings>;
}

/**
 * Write `files` (relative path -> content) into the temp dir, run
 * `applyFormatting` on them and return the result plus whatever was written.
 */
async function run(files: Record<string, string>, opts: RunOptions = {}) {
  const dtos: FilePathDTO[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(tmp, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    dtos.push(uFile.parse(rel, tmp));
  }
  let map = defaultMap;
  if (opts.ts) {
    map = new Map(defaultMap);
    map.set('.ts', { ...defaultMap.get('.ts')!, ...opts.ts });
  }
  const ctx = RunContext({
    isDryRun: opts.isDryRun ?? false,
    logger: logger.create({ warn }),
  });
  ctx.configuredSettings.extensionsMap = map;
  const result = await applyFormatting(dtos, ctx);
  const written = new Map<string, string>();
  for (const [file, content] of write.mock.calls as [string, string][]) {
    written.set(path.relative(tmp, file), content);
  }
  return { result, written };
}

/**
 * Format a single `.ts` file and return its new content.
 */
async function format(content: string, opts?: RunOptions): Promise<string> {
  const { written } = await run({ 'a.ts': content }, opts);
  return written.get('a.ts') ?? '';
}

/**
 * The label a single-line section header ended up with.
 */
async function sectionLabel(src: string, opts?: RunOptions): Promise<string> {
  const line = await format(`// @sec ${src}\n`, opts);
  return line.match(/=+ (.+?) =+/)?.[1] ?? '';
}

// ========================================================================= //
//                                    TESTS                                  //
// ========================================================================= //

describe('applyFormatting', () => {
  beforeAll(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), 'code-divider-af-'));
    const ctx = RunContext({ cwd: base });
    await configureSettings(ctx);
    defaultMap = ctx.configuredSettings.extensionsMap;
  });

  afterAll(async () => {
    await fs.rm(base, { recursive: true, force: true });
  });

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(base, 'case-'));
    // `uFile.write` is a no-op under the unit-test env, so capture what
    // would be written instead of reading it back from disk.
    write = vi.spyOn(uFile, 'write').mockResolvedValue(undefined);
    warn = vi.fn<ILogger['warn']>();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // ---- Which files get touched
  describe('file selection', () => {
    it('should return only the files that had a marker', async () => {
      const { result } = await run({
        'a.ts': '// @reg one\n',
        'b.ts': 'const x = 1;\n',
        'c.ts': '// @sec two\n',
      });
      expect(result.sort()).toEqual([
        path.join(tmp, 'a.ts'),
        path.join(tmp, 'c.ts'),
      ]);
    });

    it('should only write the files that changed', async () => {
      const { written } = await run({
        'a.ts': '// @reg one\n',
        'b.ts': 'const x = 1;\n',
      });
      expect([...written.keys()]).toEqual(['a.ts']);
    });

    it('should skip files whose extension has no settings', async () => {
      const { result, written } = await run({ 'notes.txt': '// @reg one\n' });
      expect(result).toEqual([]);
      expect(written.size).toBe(0);
    });

    it('should return an empty array for no files', async () => {
      const { result } = await run({});
      expect(result).toEqual([]);
    });

    it('should not write anything on a dry run but still report the file', async () => {
      const { result, written } = await run(
        { 'a.ts': '// @reg one\n' },
        { isDryRun: true },
      );
      expect(result).toEqual([path.join(tmp, 'a.ts')]);
      expect(written.size).toBe(0);
    });

    it('should never have more than 50 files open at once', async () => {
      const realRead = uFile.read;
      let inFlight = 0;
      let maxInFlight = 0;
      vi.spyOn(uFile, 'read').mockImplementation(async (file: string) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return await realRead(file);
        } finally {
          inFlight--;
        }
      });
      const names = Array.from({ length: 120 }, (_, i) => `f${i}.ts`);
      const files = Object.fromEntries(names.map((n) => [n, '// @reg x\n']));
      const { result } = await run(files);
      // Every file is still processed, in the original order
      expect(result).toEqual(names.map((n) => path.join(tmp, n)));
      expect(maxInFlight).toBeLessThanOrEqual(50);
      // ...and still in parallel within a batch
      expect(maxInFlight).toBeGreaterThan(1);
    });
  });

  // ---- Region headers
  describe('region markers', () => {
    it('should produce a 3-line block with the label centered', async () => {
      const out = await format('// @reg hello world\n');
      const pad = ' '.repeat(31);
      expect(out).toBe(
        [RULE, `// ${pad}HELLO WORLD${pad} //`, RULE, ''].join('\n'),
      );
    });

    it('should keep every line at the character limit', async () => {
      const lines = (await format('// @reg x\n')).split('\n');
      expect(lines[0]).toHaveLength(79);
      expect(lines[1]).toHaveLength(79);
      expect(lines[2]).toHaveLength(79);
    });

    it('should give an odd remainder to the right side', async () => {
      // 73 inner - 2 chars = 71 -> 35 left, 36 right
      const middle = (await format('// @reg ab\n')).split('\n')[1];
      expect(middle).toBe(`// ${' '.repeat(35)}AB${' '.repeat(36)} //`);
    });

    it('should keep the rule lines at the limit when the label overflows', async () => {
      const label = 'x'.repeat(200);
      const lines = (await format(`// @reg ${label}\n`)).split('\n');
      expect(lines[0]).toBe(RULE);
      expect(lines[2]).toBe(RULE);
      expect(lines[1]).toBe(`// ${label.toUpperCase()} //`);
    });
  });

  // ---- Section headers
  describe('section markers', () => {
    it('should produce a single centered line', async () => {
      const out = await format('// @sec my section\n');
      expect(out).toBe(
        `// ${'='.repeat(31)} My Section ${'='.repeat(30)} //\n`,
      );
      expect(out.trimEnd()).toHaveLength(79);
    });

    it('should give an odd remainder to the left side', async () => {
      const out = await format('// @sec ab\n');
      expect(out).toBe(`// ${'='.repeat(35)} Ab ${'='.repeat(34)} //\n`);
    });

    it('should drop the filler rather than exceed the limit when the label overflows', async () => {
      const label = 'x'.repeat(200);
      const out = await format(`// @sec ${label}\n`);
      expect(out).toBe(
        `//  ${label.charAt(0).toUpperCase()}${label.slice(1)}  //\n`,
      );
    });
  });

  // ---- Indentation and surrounding content
  describe('placement', () => {
    it('should keep the marker’s indentation and still end at the limit', async () => {
      const lines = (await format('    // @sec nested\n')).split('\n');
      expect(lines[0].startsWith('    // ')).toBe(true);
      expect(lines[0]).toHaveLength(79);
      const region = (await format('  // @reg nested\n')).split('\n');
      for (const line of region.slice(0, 3)) {
        expect(line.startsWith('  // ')).toBe(true);
        expect(line).toHaveLength(79);
      }
    });

    it('should leave every other line untouched', async () => {
      const out = await format(
        'import x from "y";\n\n// @sec a\n\nconst z = 1;\n',
      );
      const lines = out.split('\n');
      expect(lines[0]).toBe('import x from "y";');
      expect(lines[1]).toBe('');
      expect(lines[3]).toBe('');
      expect(lines[4]).toBe('const z = 1;');
      expect(lines[5]).toBe('');
    });

    it('should replace every marker in a file', async () => {
      const out = await format('// @reg a\nx\n// @sec b\ny\n// @reg c\n');
      expect(out.split('\n').filter((l) => l === RULE)).toHaveLength(4);
      expect(out).toContain(' B ');
      expect(out).not.toMatch(/@reg|@sec/);
    });

    it('should not match a marker that is not on its own line', async () => {
      const { result } = await run({ 'a.ts': 'const x = 1; // @reg a\n' });
      expect(result).toEqual([]);
    });

    it('should preserve CRLF line endings', async () => {
      const out = await format('// @reg a\r\nconst x = 1;\r\n// @sec b\r\n');
      expect(out).not.toMatch(/[^\r]\n/); // every newline is a CRLF
      expect(out.split('\r\n')).toHaveLength(6); // 3 region + 1 code + 1 section + trailing ''
    });

    it('should accept a tab between the marker and the label', async () => {
      expect(await sectionLabel('\tlabel')).toBe('Label');
    });

    it('should be idempotent', async () => {
      const first = await format('// @reg a\n// @sec b\n');
      write.mockClear();
      const { result } = await run({ 'b.ts': first });
      expect(result).toEqual([]);
    });
  });

  // ---- Label-less markers
  describe('markers with no label', () => {
    it('should leave a bare marker alone and warn with file and line', async () => {
      const { result } = await run({ 'a.ts': 'x\n// @reg\ny\n' });
      expect(result).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        `Warning: ${path.join(tmp, 'a.ts')}:2: code-divider marker has no label, skipping`,
      );
    });

    it('should treat a marker with only trailing spaces as label-less', async () => {
      const { result } = await run({ 'a.ts': '// @sec   \n' });
      expect(result).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should still format the other markers in the file', async () => {
      const out = await format('// @reg\n// @reg real\n');
      const lines = out.split('\n');
      expect(lines[0]).toBe('// @reg');
      expect(lines[1]).toBe(RULE);
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Label formatting
  describe('label formatting', () => {
    it('should uppercase region labels and capitalize section labels by default', async () => {
      const region = (await format('// @reg my Label\n')).split('\n')[1];
      expect(region).toContain('MY LABEL');
      expect(await sectionLabel('my LABEL')).toBe('My Label');
    });

    it('should honor the configured formats', async () => {
      expect(
        await sectionLabel('My Label', {
          ts: { SECTION_LABEL_FORMAT: 'lowercase' },
        }),
      ).toBe('my label');
      expect(
        await sectionLabel('My LaBeL', {
          ts: { SECTION_LABEL_FORMAT: 'none' },
        }),
      ).toBe('My LaBeL');
      expect(
        await sectionLabel('my label', {
          ts: { SECTION_LABEL_FORMAT: 'uppercase' },
        }),
      ).toBe('MY LABEL');
    });

    it('should leave words that start or end with a non-alphanumeric character alone', async () => {
      expect(await sectionLabel('@decorator stays')).toBe('@decorator Stays');
      expect(await sectionLabel('call foo()')).toBe('Call foo()');
    });

    it('should capitalize a word with an internal dot', async () => {
      expect(await sectionLabel('data.json handler')).toBe('Data.json Handler');
    });

    it('should collapse runs of whitespace between words', async () => {
      expect(await sectionLabel('a    b')).toBe('A B');
    });
  });

  // ---- Other languages / settings
  describe('per-language settings', () => {
    it('should use each language’s comment syntax and bookends', async () => {
      const { written } = await run({
        'a.py': '# @sec hello\n',
        'a.css': '/* @reg hello */\n',
      });
      expect(written.get('a.py')).toMatch(/^# =+ Hello =+ #\n$/);
      const css = written.get('a.css')!.split('\n');
      expect(css[0]).toBe(`/* ${'='.repeat(73)} */`);
      expect(css[1]).toMatch(/^\/\* +HELLO +\*\/$/);
    });

    it('should honor a custom limit and filler', async () => {
      const out = await format('// @sec hi\n', {
        ts: { CHAR_LIMIT: 40, FILLER: '-' },
      });
      // 40 - 3 - 3 - 2 - 2 = 30 filler chars, split evenly
      expect(out).toBe(`// ${'-'.repeat(15)} Hi ${'-'.repeat(15)} //\n`);
      expect(out.trimEnd()).toHaveLength(40);
    });

    it('should honor custom bookends', async () => {
      const out = await format('// @reg hi\n', {
        ts: { BOOKENDS: ['/* ', ' */'] },
      });
      const lines = out.split('\n');
      expect(lines[0]).toBe(`/* ${'='.repeat(73)} */`);
      expect(lines[1].startsWith('/* ')).toBe(true);
      expect(lines[1].endsWith(' */')).toBe(true);
    });
  });
});
