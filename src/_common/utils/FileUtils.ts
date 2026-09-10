import { Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { asyncItrToArr, isUsingNode22orAbove } from '@common/utils/misc';

import logger from '@logger';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const IS_DRY_RUN = false;
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
  isDir: null | boolean;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
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
 * Generate a file with some default content if it does not exists.
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
  }
  // Create file: `wx` means create only if doesn't exist
  return fs.writeFile(finalPath, 'FILE_UTIL_GENERATED_FILE', {
    encoding: ENCODING,
    flag: 'wx',
  });
}

/**
 * Generate a file with some default content if it does not exist.
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
      `File or folder "${finalPath}" does not exist: skipping ".rmItem"`,
    );
  }
  // Delete file/folder
  return fs.rm(finalPath, { recursive: true, force: true });
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
  include: string[],
  exclude: string[],
  targetPath: string,
): Promise<FilePathDTO[]> {
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
  // Convert the `Dirent[]` to a `FilePathDTO[]`
  const dirents: Dirent<string>[] = await asyncItrToArr(iterable);
  return dirents.map((dirent) => {
    const absPath = path.join(dirent.parentPath, dirent.name);
    const dto = parse(absPath, targetPath);
    return {
      ...dto,
      isDir: dirent.isDirectory(),
    };
  });
}

/**
 * Filter directory items by using exact path match.
 */
async function basicSearch(
  include: string[],
  exclude: string[],
  targetPath: string,
): Promise<FilePathDTO[]> {
  // If include is empty, include everything that is not excluded
  if (!include.length) {
    include.push('./');
  }
  // Get items to include
  console.log(include, exclude, targetPath); // pick up here
  let items: string[] = await listDirItemsDeep(targetPath);
  if (include.length > 0) {
    items = items.filter((item) => basicSearchHelper(item, include));
  }
  // Get items to exclude
  if (exclude.length > 0) {
    items = items.filter((item) => !basicSearchHelper(item, exclude));
  }
  // Convert items to DTO[]
  return items.map((item) => parse(item, targetPath));
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
  // Check extension
  const ext = path.extname(filePath);
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
 * @private
 */
function defaultStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Convert a filePath to a `FilePathDTO` object.
 *
 * @param {string} filePath Needs to be an absolute path or a path relative to the parent.
 * @param {string} parentPath Must be an absolute path.
 */
function parse(filePath: string, parentPath: string): FilePathDTO {
  // Validate parent path
  if (!path.isAbsolute(parentPath)) {
    throw new Error('parentPath must be absolute');
  }
  // Get the relative/absolute paths
  let relativePath;
  let absolutePath;
  if (path.isAbsolute(filePath)) {
    relativePath = path.relative(parentPath, filePath);
    absolutePath = filePath;
  } else {
    relativePath = filePath;
    absolutePath = path.join(parentPath, filePath);
  }
  // File name stuff
  const filename = path.basename(filePath);
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  // Setup dto
  return {
    absolutePath: path.normalize(absolutePath),
    parentPath: path.normalize(parentPath),
    relativePath: path.normalize(relativePath),
    filename,
    name,
    ext,
    isDir: null,
  };
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default {
  write,
  read,
  mkFile,
  mkDir,
  remove,
  exists,
  isDir,
  basicSearch,
  globSearch,
  loadJsonFile,
  saveJsonFile,
  parse,
} as const;
