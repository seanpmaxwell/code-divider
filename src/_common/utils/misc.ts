// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //
/**
 * Check if the current version of Node is v22 or greater.
 */
export function isUsingNode22orAbove() {
  const major = Number(process.versions.node.split('.')[0]);
  return major >= 22;
}

/**
 * Convert an AsyncIterator to a string[]
 */
export async function asyncItrToArr<T>(
  itr: AsyncIterator<T, undefined>,
): Promise<T[]> {
  const out: T[] = [];
  for (let r = await itr.next(); !r.done; r = await itr.next()) {
    out.push(r.value);
  }
  return out;
}

/**
 * Get an array of integers where each integer is the index in the array.
 * Shorter alternative to `for (let i = 0, i < ...`
 */
export function getRange(n: number): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('n must be a positive integer');
  }
  return [...Array(n).keys()];
}
