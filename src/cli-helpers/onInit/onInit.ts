
import isPlainObject from '@common/utils/isPlainObject';
import logger from '@common/utils/logger';

// @reg Types

type PlainObject = Record<string, unknown>;
type Result = { constructor: { name: string }};

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

// @reg Functions

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
      const resultType = (result as Result)?.constructor?.name ?? typeof result;
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

onInit.skip = function skip(_: () => void | unknown): void {};

// @reg Export

export default onInit;
