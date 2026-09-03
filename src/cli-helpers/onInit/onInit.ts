import isPlainObject from '@common/utils/isPlainObject';
import logger from '@common/utils/logger';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

type PlainObject = Record<string, unknown>;
type Result = { constructor: { name: string } };

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Default function.
 */
async function onInit<T extends PlainObject>(
  cb: () => Promise<T | void>,
): Promise<T | void> {
  try {
    const result = await cb();
    if (result !== undefined && !isPlainObject(result)) {
      const resultType = (result as Result)?.constructor?.name ?? typeof result;
      throw new TypeError(
        `onInit callback must return a plain object, got: ${resultType}`,
      );
    }
    return result as T;
  } catch (err) {
    logger.error(`onInit failed:`, err);
  }
}

onInit.skip = function skip(_: () => void | unknown): void {};

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default onInit;
