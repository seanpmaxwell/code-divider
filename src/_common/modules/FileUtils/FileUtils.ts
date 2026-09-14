import { Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import logger from '@modules/logger';

import { IS_UNIT_TEST_ENV } from '@common/constants/misc';

import gcGlobSearch from './_internal/gcGlobSearch';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ENCODING = 'utf8';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

type Stringify = (value: unknown) => string;

export interface FilePathDTO {
  absolutePath: string;
  parentPath: string;
  relativePath: string;
  filename: string; // `filename` with the extension
  name: string; // `filename` without the extension
  ext: string;
}

interface CopyOptions {
  rename?: string;
  filter?: (_: string) => boolean;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //
// Under the unit-test env `write` is a no-op, so tests can never modify real
// files. (The CLI's `--dry-run` is handled separately, in `applyFormatting`.)
// The other "fs" functions are wrapped here too, for consistency.

/**
 * Replace a file's content with `content`, unless running under the
 * unit-test env.
 */
async function write(targetPath: string, content: string): Promise<void> {
  if (!IS_UNIT_TEST_ENV) return fs.writeFile(targetPath, content, ENCODING);
}

/**
 * Return a file's contents
 */
function read(path: string): Promise<string> {
  return fs.readFile(path, ENCODING);
}

/**
 * Create a file with some placeholder content if it does not exist.
 */
async function mkFile(
  relativePath: string,
  startingDir?: string,
): Promise<void> {
  // Setup final path
  let finalPath = relativePath;
  if (startingDir && !path.isAbsolute(relativePath)) {
    finalPath = path.join(startingDir, relativePath);
  }
  // Edge cases
  if (await exists(finalPath)) {
    logger.info(`Item "${finalPath}" already exists: skipping "mkFile"`);
    return;
  }
  // Create file: `wx` means create only if doesn't exist
  return fs.writeFile(finalPath, 'FILE_UTIL_GENERATED_FILE', {
    encoding: ENCODING,
    flag: 'wx',
  });
}

/**
 * Create a folder (and any missing parents) if it does not exist.
 */
async function mkDir(
  relativePath: string,
  startingDir?: string,
): Promise<void> {
  // Setup final path
  let finalPath = relativePath;
  if (startingDir && !path.isAbsolute(relativePath)) {
    finalPath = path.join(startingDir, relativePath);
  }
  // Edge cases
  if (await exists(finalPath)) {
    logger.info(`Item "${finalPath}" already exists: skipping "mkDir"`);
    return;
  }
  await fs.mkdir(finalPath, { recursive: true });
}

/**
 * Delete a file or a directory. This works even if the folder has content.
 */
async function remove(
  relativePath: string,
  startingDir?: string,
): Promise<void> {
  // Setup final path
  let finalPath = relativePath;
  if (startingDir && !path.isAbsolute(relativePath)) {
    finalPath = path.join(startingDir, relativePath);
  }
  // Check if the path exists
  const doesExist = await exists(finalPath);
  if (!doesExist) {
    logger.info(
      `File or folder "${finalPath}" does not exist: skipping removal`,
    );
    return;
  }
  // Delete file/folder
  return fs.rm(finalPath, { recursive: true, force: true });
}

/**
 * Delete a folder's contents by deleting and recreating it.
 */
async function emptyDir(dirPath: string): Promise<void> {
  await remove(dirPath);
  return mkDir(dirPath);
}

/**
 * Copy a file or folder into `destDir`, keeping its name: `('src', 'dest')`
 * produces `dest/src`. An existing `dest/src` is deleted first, so the result
 * is an exact copy rather than a merge. Returns the path that was written.
 *
 * Throws, without deleting anything, if `src` doesn't exist or if the target
 * overlaps `src` (the same path, or one inside the other), since deleting the
 * target would destroy the source.
 */
async function copy(
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
 * Check whether `child` is `parent` itself or somewhere inside it.
 *
 * @private {@link copy}
 */
function isSameOrInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Check if a file/folder exists.
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
 * Check if the targetPath is a directory (folder).
 */
async function isDir(target: string): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    return stat.isDirectory();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * List the files (never folders) under `targetPath` that match the
 * tsconfig-style `include`/`exclude` patterns. See `gcGlobSearch` for the
 * pattern rules.
 */
async function globSearch(
  include: string[],
  exclude: string[],
  targetPath: string,
): Promise<FilePathDTO[]> {
  const dirents = await gcGlobSearch(include, exclude, targetPath);
  return parseDirentArr(dirents, targetPath);
}

/**
 * Convert json file to an object.
 */
async function loadJsonFile<T = Record<string, unknown>>(
  filePath: string,
): Promise<T> {
  // Check extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json')
    throw new Error('To load a JSON file, extension must be .json');
  // Load file
  const fileContent = await fs.readFile(filePath, 'utf8');
  // Parse it
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid JSON in "${filePath}": ${reason}`, {
      cause: err,
    });
  }
  // Make sure it's an object
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`expected "${filePath}" to contain a JSON object or array`);
  }
  // Return
  return parsed as T;
}

/**
 * Save an object (or array) to a JSON file. Appends ".json" to the path unless
 * it already ends with it. Pass `stringify` to control serialization (defaults
 * to JSON.stringify with 2-space indentation). Returns the path written to.
 */
async function saveJsonFile(
  filePath: string,
  value: unknown,
  stringify: Stringify = defaultStringify,
): Promise<string> {
  const doesEndWithJson = filePath.toLowerCase().endsWith('.json');
  const fullPath = doesEndWithJson ? filePath : `${filePath}.json`;
  const fileContent = stringify(value);
  await fs.writeFile(fullPath, `${fileContent}\n`, 'utf8');
  return fullPath;
}

/**
 * Default serializer: pretty JSON with 2-space indentation.
 *
 * @private {@link saveJsonFile}
 */
function defaultStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Convert a relativePath + parentPath to a `FilePathDTO` object
 *
 * @param {string} parentPath Must be an absolute path.
 */
function parse(relativePath: string, parentPath: string): FilePathDTO {
  // Validate parent path
  if (!path.isAbsolute(parentPath)) {
    throw new Error('parentPath must be absolute');
  }
  // Get the relative/absolute paths
  const relativePath_ = path.normalize(relativePath);
  const parentPath_ = path.normalize(parentPath);
  const absolutePath = path.join(parentPath_, relativePath_);
  const filename = path.basename(relativePath_);
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  // Setup dto
  return {
    absolutePath,
    parentPath: parentPath_,
    relativePath: relativePath_,
    filename,
    name,
    ext,
  };
}

// ============================= Shared Helpers ============================ //

/**
 * Convert a `Dirent<string>` array to a `FilePathDTO` object array
 *
 * @private {@link globSearch}
 */
function parseDirentArr(
  arr: Dirent<string>[],
  targetPath: string,
): FilePathDTO[] {
  return arr.map((item) => parseDirent(item, targetPath));
}

/**
 * Convert a `Dirent<string>` object to a `FilePathDTO` object
 *
 * @private {@link parseDirentArr}
 * @param {Dirent<string>} dirent
 * @param {string} targetPath Must be an absolute path.
 */
function parseDirent(dirent: Dirent<string>, targetPath: string): FilePathDTO {
  const absPath = path.join(dirent.parentPath, dirent.name);
  const relativePath = path.relative(targetPath, absPath);
  return parse(relativePath, targetPath);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default {
  write,
  read,
  rm: remove,
  exists,
  isDir,
  mkDir,
  emptyDir,
  globSearch,
  loadJsonFile,
  saveJsonFile,
  parse,
  testOnly: {
    mkFile,
    parseDirentArr,
    copyTo: copy,
  },
} as const;
