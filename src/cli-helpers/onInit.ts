import logger from '@common/utils/logger';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Default function.
 */
async function onInit<T>(
  cb: () => Promise<T>,
  cbName?: string,
): Promise<T | void> {
  // Set the name for the callbackfunction if passed
  if (cbName)
    Object.defineProperty(cb, 'name', { value: cbName, configurable: true });
  // Call the callback and catch errors
  try {
    const result = await cb();
    return result;
  } catch (err) {
    logger.error(`onInit failed:`, err);
  }
}

// Useful for temporarily disabling the callback (i.e. playgrounds)
onInit.skip = function skip(_: () => void | unknown): void {};

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default onInit;
