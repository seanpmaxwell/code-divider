
import isPlainObject from '../../_common/utils/isPlainObject';
import logger from '../../_common/utils/logger';

type PlainObject = Record<string, unknown>;

/**
 * Operator overloads
 */
async function onInit<T extends PlainObject | void>(
  cb: () => Promise<T>,
): Promise<T | void>;
async function onInit<T extends PlainObject | void>(
  cb: () => Promise<T>,
  opts: { throwOnError: true },
): Promise<T | void>;
async function onInit<T extends PlainObject | void>(
  cb: () => Promise<T>,
  opts: { throwOnError: false },
): Promise<T | { error: unknown } | void>;

/**
 * Default function.
 */
async function onInit<T extends PlainObject | void>(
  cb: () => Promise<T>,
  opts: { throwOnError: boolean } = { throwOnError: true },
): Promise<T | { error: unknown } | void> {
  try {
    const result = await cb();
    if (result !== undefined && !isPlainObject(result)) {
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
    return { error: err };
  }
}

onInit.skip = function skip(cb: () => void | unknown): void {};

export default onInit;
