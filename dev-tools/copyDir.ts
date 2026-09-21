import fs from 'fs/promises';
import path from 'path';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface CopyOptions {
  rename?: string;
  filter?: (_: string) => boolean;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Copy a file or folder into `destDir`, keeping its name: `('src', 'dest')`
 * produces `dest/src`. An existing `dest/src` is deleted first, so the result
 * is an exact copy rather than a merge. Returns the path that was written.
 *
 * Throws, without deleting anything, if `src` doesn't exist or if the target
 * overlaps `src` (the same path, or one inside the other), since deleting the
 * target would destroy the source.
 */
async function copyDir(
  src: string,
  destDir: string,
  options: CopyOptions = {},
): Promise<string> {
  // Init `filter`
  const { filter, rename } = options;
  const filter_ = filter ? { filter } : {};
  // Init `target`
  const srcAbs = path.resolve(src);
  const destBase = rename ? rename : path.basename(srcAbs);
  const target = path.join(path.resolve(destDir), destBase);
  // Fail on a missing source before anything is deleted
  if (!(await exists(srcAbs))) {
    throw new Error(`src path ${srcAbs} does not exist`);
  }
  // Refuse any overlap between the source and the target
  if (isSameOrInside(target, srcAbs) || isSameOrInside(srcAbs, target)) {
    throw new Error(
      `Cannot copy "${srcAbs}" to "${target}": the paths overlap`,
    );
  }
  // Replace, don't merge
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(srcAbs, target, {
    recursive: true,
    verbatimSymlinks: true,
    ...filter_,
  });
  return target;
}

/**
 * Check if a file/folder exists.
 *
 * Used by: {@link copyDir}
 *
 * @private
 */
async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether `child` is `parent` itself or somewhere inside it.
 *
 * Used by: {@link copyDir}
 *
 * @private
 */
function isSameOrInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default copyDir;
