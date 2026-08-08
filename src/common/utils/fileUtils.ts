import fs, { Dirent } from 'fs';
import { SharedSettings } from '../types';

// ========================================================================= //
//                                   Types                                   //
// ========================================================================= //

type Stringify = (value: unknown) => string;


// ========================================================================= //
//                                  Classes                                  //
// ========================================================================= //
// During a dry-run, we want to skip modifying files. To create consistency,
// I just decided to wrap the other "fs" library functions too.

class FileUtils {
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
   * Check if the targetPath is a directory (folder).
   */
  public isDir(targetPath: string): boolean {
    return fs.statSync(targetPath).isDirectory();
  }

  /**
   * Fetch a list (non-recursively) of the files in a directory.
   */
  public fetchDirFiles(targetPath: string): Dirent<string>[] {
    return fs.readdirSync(targetPath, { withFileTypes: true });
  }

  /**
   * Check if a file exists.
   */
  public exists(target: string): boolean {
    return fs.existsSync(target);
  }

  /**
   * Get a string array of all the files in a directory. By default uses
   * a glob pattern but for nodejs versions < v22 will just use the `preNode22:`
   * flag.
   */
  public getDirFiles(settings: SharedSettings) {
    // pick up here
    fs.glob()
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
      throw new Error(`invalid JSON in "${filePath}": ${reason}`, { cause: err });
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
