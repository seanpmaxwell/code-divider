import fs from 'fs/promises';
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

import type { IRunContext } from '@common/types/RunContext';
import type {
  ConfiguredLangSettings,
  ExtensionsMap,
} from '@common/types/settings';

import uFile, { FileCtx } from '@utilm/uFile';

import { type ILogger, SilentLogger } from '@logger';

import { createLogger, makeTmpDir, JS_RULE as RULE } from '@test/_common/utils';

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
  const dtos: FileCtx[] = [];
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
  const ctx: IRunContext = {
    cwd: tmp,
    targetDir: tmp,
    targetFile: null,
    configFilePath: null,
    filter: { include: [], exclude: [] },
    extensionsMap: map,
    isDryRun: opts.isDryRun ?? false,
    logger: createLogger({ warn }),
  };
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
//                                   TESTS                                   //
// ========================================================================= //

describe('applyFormatting', () => {
  beforeAll(async () => {
    base = await makeTmpDir('af');
    const settings = await configureSettings({
      cwd: base,
      targetPath: '',
      configFilePath: null,
      config: null,
      logger: SilentLogger,
    });
    defaultMap = settings.extensionsMap;
  });

  afterAll(async () => {
    await fs.rm(base, { recursive: true, force: true });
  });

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(base, 'case-'));
    // Capture what would be written instead of reading it back from disk.
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

    it('should collapse runs of whitespace between words, under every format', async () => {
      expect(await sectionLabel('a    b')).toBe('A B');
      expect(
        await sectionLabel('a    b', { ts: { SECTION_LABEL_FORMAT: 'none' } }),
      ).toBe('a b');
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

  // ---- Line endings
  describe('line endings', () => {
    it('should keep the ending of each line in a file with mixed endings', async () => {
      const out = await format(
        'const a = 1;\r\n// @reg one\nconst b = 2;\r\n// @sec two\n',
      );
      const lines = out.split('\n');
      expect(lines[0]).toBe('const a = 1;\r');
      expect(lines[1]).toBe(RULE);
      expect(lines[2]).toContain('ONE');
      expect(lines[3]).toBe(RULE);
      expect(lines[4]).toBe('const b = 2;\r');
      expect(lines[5]).toMatch(/^\/\/ =+ Two =+ \/\/$/);
      expect(lines[6]).toBe('');
    });

    it('should use the ending of the marker line for the extra region lines', async () => {
      const out = await format('x\r\n// @reg one');
      expect(out).toBe(
        'x\r\n' +
          [RULE, `// ${' '.repeat(35)}ONE${' '.repeat(35)} //`, RULE].join(
            '\r\n',
          ),
      );
    });

    it('should not add a trailing newline to a file that has none', async () => {
      const out = await format('// @sec a');
      expect(out.endsWith('\n')).toBe(false);
    });
  });

  // ---- Existing dividers
  describe('existing dividers', () => {
    const narrowRule = `// ${'='.repeat(34)} //`; // limit 40

    it('should re-center an existing section divider when the limit changes', async () => {
      const existing = await format('// @sec my label\n');
      const out = await format(existing, { ts: { CHAR_LIMIT: 40 } });
      expect(out).toBe(`// ${'='.repeat(12)} My Label ${'='.repeat(12)} //\n`);
    });

    it('should rebuild an existing region block when the limit changes', async () => {
      const existing = await format('  // @reg hello\nconst x = 1;\n');
      const out = await format(existing, { ts: { CHAR_LIMIT: 40 } });
      const lines = out.split('\n');
      expect(lines[0]).toBe(`  // ${'='.repeat(32)} //`);
      expect(lines[1]).toBe(`  // ${' '.repeat(13)}HELLO${' '.repeat(14)} //`);
      expect(lines[2]).toBe(lines[0]);
      expect(lines[3]).toBe('const x = 1;');
    });

    it('should re-apply the label format to existing dividers', async () => {
      const existing = await format('// @sec my label\n');
      const out = await format(existing, {
        ts: { SECTION_LABEL_FORMAT: 'uppercase' },
      });
      expect(out).toContain(' MY LABEL ');
    });

    it('should leave a hand-written box alone when its lines differ in width', async () => {
      const box = [narrowRule, '// some comment //', narrowRule, ''].join('\n');
      const { result } = await run({ 'a.ts': box });
      expect(result).toEqual([]);
    });

    it('should leave three rule lines in a row alone', async () => {
      const { result } = await run({
        'a.ts': [RULE, RULE, RULE, ''].join('\n'),
      });
      expect(result).toEqual([]);
    });

    it('should not touch a lone rule line or a plain comment', async () => {
      const { result } = await run({
        'a.ts': `${RULE}\n// a = b\n// ===\n`,
      });
      expect(result).toEqual([]);
    });

    it('should handle a label that contains the filler character', async () => {
      const first = await format('// @sec a = b\n');
      expect(first).toContain(' A = B ');
      write.mockClear();
      const second = await format(first);
      expect(second).toBe(''); // nothing written: already up to date
    });
  });

  // ---- Extension lookup
  describe('extension lookup', () => {
    it('should match extensions case-insensitively', async () => {
      const { result } = await run({ 'a.TS': '// @reg one\n' });
      expect(result).toEqual([path.join(tmp, 'a.TS')]);
    });
  });
});
