import type { InitialSettings } from '@common/types/settings';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

/**
 * A config that exercises every branch of the config serializer used by
 * `initDir`: arrays of primitives (kept on one line), arrays containing
 * objects or nested arrays (expanded one item per line), empty arrays and
 * objects, every primitive type, and strings that need escaping.
 *
 * It is not a valid code-divider config, so it is cast to `InitalSettings`
 * purely to satisfy `initDir`'s signature.
 */
const EdgeCaseConfig = {
  primitives: ['a', 1, true, null],
  empty: [],
  emptyObj: {},
  objects: [{ a: 1 }, { b: ['x', 'y'] }],
  nested: [[1, 2], [3]],
  mixed: [1, { c: null }],
  deep: { list: [{ name: 'q"uote', tags: ['t\\1'] }] },
  scalar: 'str',
  num: 2.5,
  flag: false,
  nothing: null,
} as unknown as InitialSettings;

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default EdgeCaseConfig;
