import type { Dirent } from 'fs';
import path from 'path';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Create a dummy `Dirent<string>` object. NOTE: if you want to set it as a
 * directory, your path needs to end with `/`.
 */
export function getDummyDirent(
  relativePath: string,
  parentPath: string,
): Dirent<string> {
  const fullPath = path.join(parentPath, relativePath);
  const isDir = relativePath.endsWith('/');
  return {
    name: path.basename(fullPath),
    parentPath: path.dirname(fullPath),
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isSymbolicLink: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  };
}
