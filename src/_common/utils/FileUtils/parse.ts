import path from 'path';

// ========================================================================= //
//                                    Types                                  //
// ========================================================================= //

export interface FilePathMd {
  absolutePath: string;
  parentPath: string;
  relativePath: string;
  filename: string; // `file name` with the extension
  name: string; // `file name` without the extension
  ext: string;
  isDir?: boolean;
}

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Convert a filePath to a `FilePathMd` object. Note, if you don't pass
 * parentPath then filePath must be an absolute path.
 */
function parse(filePath: string, parentPath?: string): FilePathMd {
  if (path.isAbsolute(filePath)) {
    return parseFromAbsolutePath(filePath);
  }
  if (!parentPath) {
    throw new Error('Parent-path must be present if filePath is not absolute');
  }
  return parseFromSplitPaths(filePath, parentPath);
}

/**
 * @private
 * @see {parse}
 *
 * Get the file path data but hardcode the parent path to something other
 * than the current working directory.
 */
function parseFromSplitPaths(
  relativePathParam: string,
  parentPath: string,
): FilePathMd {
  // Validate parent path
  if (!path.isAbsolute(parentPath)) {
    throw new Error('parentPath must be absolute');
  }
  // Relative Path
  const relativePath = path.isAbsolute(relativePathParam)
    ? path.relative(parentPath, relativePathParam)
    : relativePathParam;
  // Instantiate data object
  const absolutePath = path.join(parentPath, relativePath);
  const fileData = parseFromAbsolutePath(absolutePath);
  fileData.parentPath = parentPath;
  fileData.relativePath = relativePath;
  // Return
  return fileData;
}

/**
 * @private
 * @see {parse}
 *
 * Get file path data from the absolute path and the relativePath from the
 * current working directory.
 */
function parseFromAbsolutePath(absPath: string): FilePathMd {
  // Make sure it's an absolute path
  if (!path.isAbsolute(absPath)) {
    throw new Error('.of must receive an absolute path');
  }
  // Parse values
  const filename = path.basename(absPath);
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  const relativePath = path.relative(process.cwd(), absPath);
  // Set the values
  return {
    absolutePath: absPath,
    parentPath: process.cwd(),
    relativePath,
    filename,
    name,
    ext,
  };
}

// ========================================================================= //
//                                  Export                                   //
// ========================================================================= //

export default parse;
