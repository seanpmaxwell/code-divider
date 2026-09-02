import isPlainObject from '../isPlainObject';
import logger from '../logger';

/**
 * Operator overloads
 */
async function onInit<T extends Record<string, unknown>>(
  cb: () => Promise<T>,
): Promise<T>;
async function onInit<T extends Record<string, unknown>>(
  cb: () => Promise<T>,
  opts: { throwOnError: true },
): Promise<T>;
async function onInit<T extends Record<string, unknown>>(
  cb: () => Promise<T>,
  opts: { throwOnError: false },
): Promise<T | undefined>;

/**
 * Default function.
 */
async function onInit<T extends Record<string, unknown>>(
  cb: () => Promise<T>,
  opts: { throwOnError: boolean } = { throwOnError: true },
): Promise<T | undefined> {
  try {
    const result = await cb();
    if (!isPlainObject(result)) {
      const resultType = (result as any)?.constructor?.name ?? typeof result;
      throw new TypeError(
        `onInit callback must return a plain object, got: ${resultType}`,
      );
    }
    return result as T;
  } catch (err) {
    logger.error(`onInit failed:`, err);
    if (opts.throwOnError) {
      throw new Error(`onInit failed: ${(err as Error).message}`, {
        cause: err,
      });
    }
    return undefined;
  }
}

onInit.skip = function skip(): void {};

export default onInit;
