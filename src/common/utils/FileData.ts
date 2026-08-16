import path from 'path';

// ========================================================================= //
//                                  Classes                                  //
// ========================================================================= //
// Created this so I would constantly have to deal with `node:path` actions

interface IFileData {
  absolutePath: string;
  workingDir: string;
  relativePath: string;
  filename: string;
  extension: string;
}

class FileData implements IFileData {

  // Accessors
  #absolutePath: string;
  #workingDir: string;
  #relativePath: string;
  #filename: string;
  #extension: string;

  /**
   * of: Factory Function
   */
  // public static of(targetDir: string, relativePath: string): FileData {
  //   const fileData = new FileData();
  //   const abs = path.join(targetDir, relativePath);
  //   fileData.absolutePath(abs);
  // }
    // Accessor: absolutePath
    get absolutePath() { return this.#absolutePath; }
    set absolutePath(value: string) { this.#absolutePath = value; }

    // Accessor: workingDir
    get workingDir() { return this.#workingDir; }
    set workingDir(value: string) { this.#workingDir = value; }

    // Accessor: relativePath
    get relativePath() { return this.#relativePath; }
    set relativePath(value: string) { this.#relativePath = value; }

    // Accessor: filename
    get filename() { return this.#filename; }
    set filename(value: string) { this.#filename = value; }

    // Accessor: extension
    get extension() { return this.#extension; }
    set extension(value: string) { this.#extension = value; }
}

// ========================================================================= //
//                                  Export                                   //
// ========================================================================= //

export default FileData;
