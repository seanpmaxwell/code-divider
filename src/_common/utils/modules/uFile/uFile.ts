import type { Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import UserError from '@common/utils/classes/UserError';

import gcGlobSearch from './_internal/gcGlobSearch';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ENCODING = 'utf8';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export interface FileCtx {
  absolutePath: string;
  parentPath: string;
  relativePath: string;
  filename: string; // `filename` with the extension
  name: string; // `filename` without the extension
  ext: string;
}

export type PathType = 'file' | 'directory' | 'other';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Replace a file's content with `content`.
 */
function write(targetPath: string, content: string): Promise<void> {
  return fs.writeFile(targetPath, content, ENCODING);
}

/**
 * Return a file's contents
 */
function read(targetPath: string): Promise<string> {
  return fs.readFile(targetPath, ENCODING);
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
 * Tell a file, a directory and a missing path apart with a single `stat`.
 * Returns `null` when nothing exists at `target`.
 */
async function pathType(target: string): Promise<PathType | null> {
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) return 'directory';
    if (stat.isFile()) return 'file';
    return 'other';
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Check if the targetPath is a directory (folder).
 */
async function isDir(target: string): Promise<boolean> {
  return (await pathType(target)) === 'directory';
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
): Promise<FileCtx[]> {
  const dirents = await gcGlobSearch(include, exclude, targetPath);
  return dirents.map((dirent) => parseDirent(dirent, targetPath));
}

/**
 * Convert a `Dirent<string>` object to a `FileCtx` object
 *
 * Used by: {@link globSearch}
 *
 * @private
 * @param {Dirent<string>} dirent
 * @param {string} targetPath Must be an absolute path.
 */
function parseDirent(dirent: Dirent<string>, targetPath: string): FileCtx {
  const absPath = path.join(dirent.parentPath, dirent.name);
  const relativePath = path.relative(targetPath, absPath);
  return parse(relativePath, targetPath);
}

/**
 * Convert json file to an object.
 */
async function loadJsonFile<T = Record<string, unknown>>(
  filePath: string,
): Promise<T> {
  // Check extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json') {
    throw new UserError('To load a JSON file, extension must be .json');
  }
  // Load file
  const fileContent = await fs.readFile(filePath, ENCODING);
  // Parse it
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new UserError(`invalid JSON in "${filePath}": ${reason}`, {
      cause: err,
    });
  }
  // Make sure it's an object
  if (parsed === null || typeof parsed !== 'object') {
    throw new UserError(
      `expected "${filePath}" to contain a JSON object or array`,
    );
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
  stringify = (val: unknown) => JSON.stringify(val, null, 2),
): Promise<string> {
  const doesEndWithJson = filePath.toLowerCase().endsWith('.json');
  const fullPath = doesEndWithJson ? filePath : `${filePath}.json`;
  const fileContent = stringify(value);
  await fs.writeFile(fullPath, `${fileContent}\n`, ENCODING);
  return fullPath;
}

/**
 * Convert a relativePath + parentPath to a `FileCtx` object
 *
 * @param {string} parentPath Must be an absolute path.
 */
function parse(relativePath: string, parentPath: string): FileCtx {
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

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default {
  write,
  read,
  exists,
  pathType,
  isDir,
  globSearch,
  loadJsonFile,
  saveJsonFile,
  parse,
} as const;
