import logger from '@common/utils/logger';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Default function.
 */
async function onInit<T>(
  cb: () => Promise<T>,
): Promise<T | void> {
  try {
    const result = await cb();
    return result;
  } catch (err) {
    logger.error(`onInit failed:`, err);
  }
}

onInit.skip = function skip(_: () => void | unknown): void {};

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default onInit;
