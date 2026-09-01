import { Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { asyncItrToArr, isUsingNode22orAbove } from '@common/utils/misc';
import logger from '@logger';

import parse, { FilePathMd } from './parse';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const IS_DRY_RUN = false;
const ENCODING = 'utf8';

// ========================================================================= //
//                                   Types                                   //
// ========================================================================= //

type Stringify = (value: unknown) => string;

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //
// During a dry-run, we want to skip modifying files. To create consistency,
// I just decided to wrap the other "fs" library functions too.

/**
 * Replace a file's content with the "content:" param, unless doing a
 * dry-run.
 */
async function write(targetPath: string, content: string): Promise<void> {
  if (!IS_DRY_RUN) {
    return fs.writeFile(targetPath, content, ENCODING);
  }
}

/**
 * Return a file's contents
 */
function read(path: string): Promise<string> {
  return fs.readFile(path, ENCODING);
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
 * List all the items in a directory (including sub-directory) by their
 * fullPath relative to the target.
 */
async function listDirItemsDeep(
  targetPath: string,
  returnFullPaths = false,
): Promise<string[]> {
  const result = await fs.readdir(targetPath, {
    withFileTypes: true,
    recursive: true,
  });
  return result.map((result) => {
    const fullPath = path.join(result.parentPath, result.name);
    if (returnFullPaths) return fullPath;
    return path.relative(targetPath, fullPath);
  });
}

/**
 * List directory items using a glob pattern. If the glob contains the
 * recursive pattern `/**` then the search will be recursive.
 */
async function globSearch(
  include: string[] = [],
  exclude: string[] = [],
  targetPath: string,
): Promise<FilePathMd[]> {
  // Check node version first
  if (!isUsingNode22orAbove()) {
    logger.warn(
      'Warning: node >= v22 required to use glob patterns. Using exact match instead.',
    );
    return basicSearch(include, exclude, targetPath);
  }
  // If include is empty, include everything that is not excluded
  if (!include.length) {
    include.push('**/*');
  }
  // Run the glob search
  const iterable = await fs.glob(include, {
    exclude,
    cwd: targetPath,
    withFileTypes: true,
  });
  // Convert the `Dirent[]` to a `FilePathMd[]`
  const dirents: Dirent<string>[] = await asyncItrToArr(iterable);
  return dirents.map((dirent) => parseDirent(dirent));
}

/**
 * @private
 * @see {globSearch}
 * 
 * Filter directory items by using exact path match.
 */
async function basicSearch(
  include: string[] = [],
  exclude: string[] = [],
  targetPath: string,
): Promise<FilePathMd[]> {
  let items = await listDirItemsDeep(targetPath);
  if (include.length > 0) {
    items = items.filter((item) => basicSearchHelper(item, include));
  }
  if (exclude.length > 0) {
    items = items.filter((item) => !basicSearchHelper(item, exclude));
  }
  return items.map((item) => parse(item));
}

/**
 * @private
 * @see {basicSearch}
 */
function basicSearchHelper(path: string, searchArr: string[]): boolean {
  return searchArr.some((searchItem) => path.startsWith(searchItem));
}

/**
 * Convert json file to an object.
 */
async function loadJsonFile<T = Record<string, unknown>>(
  filePath: string,
): Promise<T> {
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
 * @private
 *
 * Default serializer: pretty JSON with 2-space indentation.
 */
function defaultStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * `fs.glob` returns a Dirent object instead of a string so we need to format
 */
function parseDirent(dirent: Dirent<string>): FilePathMd {
  const { name, parentPath } = dirent;
  const fullPath = path.join(parentPath, name);
  const mdObj = parse(fullPath);
  return {
    ...mdObj,
    isDir: dirent.isDirectory(),
  };
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default {
  write,
  read,
  exists,
  isDir,
  globSearch,
  loadJsonFile,
  saveJsonFile,
} as const;
