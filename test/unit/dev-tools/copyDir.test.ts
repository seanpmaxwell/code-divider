import fs from 'fs/promises';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import copyDir from '@dev-tools/copyDir';

import { makeTmpDir, mkFile } from '@test/_common/utils';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

let tmp: string;
let SRC: string;

const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false,
  );

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('copyDir', () => {
  beforeAll(async () => {
    tmp = await makeTmpDir('copy');
    SRC = path.join(tmp, 'copy-src');
    await mkFile(path.join(SRC, 'a.txt'));
    await mkFile(path.join(SRC, 'sub', 'b.txt'));
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('should copy a folder into the destination, keeping its name', async () => {
    const dest = path.join(tmp, 'copy-dest');
    const target = await copyDir(SRC, dest);
    expect(target).toBe(path.join(dest, 'copy-src'));
    expect(await exists(path.join(target, 'a.txt'))).toBe(true);
    expect(await exists(path.join(target, 'sub', 'b.txt'))).toBe(true);
  });

  it('should rename the copy with the `rename` option', async () => {
    const target = await copyDir(SRC, path.join(tmp, 'copy-dest'), {
      rename: 'renamed',
    });
    expect(target).toBe(path.join(tmp, 'copy-dest', 'renamed'));
    expect(await exists(path.join(target, 'a.txt'))).toBe(true);
  });

  it('should replace an existing target instead of merging', async () => {
    const dest = path.join(tmp, 'copy-replace');
    const stale = path.join(dest, 'copy-src', 'STALE.txt');
    await mkFile(stale);
    await copyDir(SRC, dest);
    expect(await exists(stale)).toBe(false);
    expect(await exists(path.join(dest, 'copy-src', 'a.txt'))).toBe(true);
  });

  it('should skip entries rejected by `filter`', async () => {
    const dest = path.join(tmp, 'copy-filtered');
    const target = await copyDir(SRC, dest, {
      filter: (src) => path.basename(src) !== 'sub',
    });
    expect(await exists(path.join(target, 'a.txt'))).toBe(true);
    expect(await exists(path.join(target, 'sub'))).toBe(false);
  });

  it('should throw for a missing source without deleting the existing target', async () => {
    const dest = path.join(tmp, 'copy-missing');
    const keep = path.join(dest, 'ghost', 'keep.txt');
    await mkFile(keep);
    await expect(copyDir(path.join(tmp, 'ghost'), dest)).rejects.toThrow(
      /does not exist/,
    );
    expect(await exists(keep)).toBe(true);
  });

  it('should refuse to copy a folder into itself', async () => {
    await expect(copyDir(SRC, path.dirname(SRC))).rejects.toThrow(/overlap/);
    await expect(copyDir(SRC, path.join(SRC, 'sub'))).rejects.toThrow(
      /overlap/,
    );
    // Source untouched
    expect(await exists(path.join(SRC, 'a.txt'))).toBe(true);
  });
});
