import fs from 'fs';
import path from 'path';
import { isUsingNode22orAbove } from './misc';
import logger from './logger';

// ========================================================================= //
//                                   Types                                   //
// ========================================================================= //

type Stringify = (value: unknown) => string;

// ========================================================================= //
//                                  Classes                                  //
// ========================================================================= //
// During a dry-run, we want to skip modifying files. To create consistency,
// I just decided to wrap the other "fs" library functions too.

export class FileUtils {
  private isDryRun = false;
  private static readonly ENCODING = 'utf8';

  public setIsDryRun(value: boolean): void {
    this.isDryRun = value;
  }

  public getIsDryRun(): boolean {
    return this.isDryRun;
  }

  /**
   * Replace a file's content with the "content:" param, unless doing a
   * dry-run.
   */
  public write(targetPath: string, content: string): void {
    if (!this.isDryRun) {
      fs.writeFileSync(targetPath, content, FileUtils.ENCODING);
    }
  }

  /**
   * Return a file's contents
   */
  public read(path: string): string {
    return fs.readFileSync(path, FileUtils.ENCODING);
  }

  /**
   * Check if a file exists.
   */
  public exists(target: string): boolean {
    return fs.existsSync(target);
  }

  /**
   * Check if the targetPath is a directory (folder).
   */
  public isDir(targetPath: string): boolean {
    return fs.statSync(targetPath).isDirectory();
  }

  /**
   * If the path ends in '/' create a directory, else create a file with
   * an empty string as the only content.
   */
  public createItem(relativePath: string, startingDir?: string): void {
    let finalPath = relativePath;
    if (startingDir && !path.isAbsolute(relativePath)) {
      finalPath = path.join(startingDir, relativePath);
    }
    if (this.exists(finalPath)) {
      return logger.info(
        `Item "${finalPath}" already exists: skipping ".createItem"`,
      );
    } else if (relativePath.endsWith('/')) {
      fs.mkdirSync(finalPath, { recursive: true });
      return;
    } else {
      // `wx` means create only if doesn't exist
      return fs.writeFileSync(finalPath, '', {
        encoding: FileUtils.ENCODING,
        flag: 'wx',
      });
    }
  }

  /**
   * Delete a file or a directory. This works even if the folder has content.
   */
  public rmItem(relativePath: string, startingDir?: string): void {
    let finalPath = relativePath;
    if (startingDir && !path.isAbsolute(relativePath)) {
      finalPath = path.join(startingDir, relativePath);
    }
    if (!this.exists(finalPath)) {
      return logger.info(
        `File or folder "${finalPath}" does not exist: skipping ".rmItem"`,
      );
    } else if (this.isDir(finalPath)) {
      return fs.rmSync(finalPath, { recursive: true, force: true });
    } else {
      return fs.rmSync(finalPath);
    }
  }

  /**
   * List all the items in a directory (including sub-directory) by their
   * fullPath relative to the target.
   */
  public listDirItemsShallow(targetPath: string): string[] {
    const result = fs.readdirSync(targetPath, { withFileTypes: true });
    return result.map(result => result.name);
  }

  /**
   * List all the items in a directory (including sub-directory) by their
   * fullPath relative to the target.
   */
  public listDirItemsDeep(
    targetPath: string,
    returnFullPaths = false,
  ): string[] {
    const result = fs.readdirSync(targetPath, {
      withFileTypes: true,
      recursive: true,
    });
    return result.map(result => {
      const fullPath = path.join(result.parentPath, result.name);
      if (returnFullPaths) return fullPath;
      return path.relative(targetPath, fullPath);
    });
  }

  /**
   * Filter directory items by using exact path match.
   */
  public filterDirItems(
    include: string[] = [],
    exclude: string[] = [],
    targetPath: string,
  ): string[] {
    let items = this.listDirItemsDeep(targetPath);
    if (include.length > 0) {
      items = items.filter(item => this.filterDirItemsHelper(item, include));
    }
    if (exclude.length > 0) {
      items = items.filter(item => !this.filterDirItemsHelper(item, exclude));
    }
    return items;
  }

  /**
   * @private
   * @see {filterDirItems}
   */
  private filterDirItemsHelper(path: string, searchArr: string[]): boolean {
    return searchArr.some(searchItem => path.startsWith(searchItem));
  }

  /**
   * List directory items using a glob pattern. If the glob contains the
   * recursive pattern `/**` then the search will be recursive.
   */
  public filterDirItemsGlob(
    include: string[] = [],
    exclude: string[] = [],
    targetPath: string,
  ): string[] {
    // Check node version
    if (!isUsingNode22orAbove()) {
      logger.warn(
        'Warning: node >= v22 required to use glob patterns. Using exact match instead.',
      );
      return this.filterDirItems(include, exclude, targetPath);
    }
    // Setup the `excludedSet`
    let excludedSet = new Set();
    if (Array.isArray(exclude) && exclude.length >= 1) {
      const excludedItems = fs.globSync(exclude, { cwd: targetPath });
      excludedSet = new Set(excludedItems);
    }
    // Run the glob search
    const toInclude = fs.globSync(include, { cwd: targetPath });
    return toInclude.filter(item => !excludedSet.has(item));
  }

  /**
   * Convert json file to an object.
   */
  public loadJsonFile<T = Record<string, unknown>>(filePath: string): T {
    const fileContent = fs.readFileSync(filePath, 'utf8');
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
      throw new Error(
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
  public saveJsonFile(
    filePath: string,
    value: unknown,
    stringify: Stringify = this.defaultStringify,
  ): string {
    const doesEndWithJson = filePath.toLowerCase().endsWith('.json');
    const fullPath = doesEndWithJson ? filePath : `${filePath}.json`;
    const fileContent = stringify(value);
    fs.writeFileSync(fullPath, `${fileContent}\n`, 'utf8');
    return fullPath;
  }

  /**
   * @private
   *
   * Default serializer: pretty JSON with 2-space indentation.
   */
  public defaultStringify(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default new FileUtils();
