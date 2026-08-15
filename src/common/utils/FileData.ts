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
  #absolutePath = '';
  #workingDir = '';
  #relativePath = '';
  #filename = '';
  #extension = '';

  /**
   * of: Factory Function
   */
  // public static of(targetDir: string, relativePath: string): FileData {
  //   const fileData = new FileData();
  //   const abs = path.join(targetDir, relativePath);
  //   fileData.absolutePath(abs);
  // }

}

// ========================================================================= //
//                                  Export                                   //
// ========================================================================= //

export default FileData;
