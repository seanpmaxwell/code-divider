import insertCodeDividers from './insertCodeDividers';
import initializeDirectory from './initializeDirectory';
import fileUtils from './common/utils/fileUtils';
import logger from './common/utils/logger';

export {
  insertCodeDividers,
  initializeDirectory,
  fileUtils,
  logger,
};

export type * from './common/types';
export default insertCodeDividers;


console.log()
// pick up here
// First do the includes, then the excludes
// if fs.glob in not truthy, then use the nodePre22 exclude
