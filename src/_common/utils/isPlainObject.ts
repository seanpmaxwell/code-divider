
/**
 * An object is plain if it's created by either an object-literal, 
 * new Object(), or Object.create(null).
 */
function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === null ||
      prototype === Object.prototype ||
      Object.getPrototypeOf(prototype) === null) &&
    !(Symbol.toStringTag in value) &&
    !(Symbol.iterator in value)
  );
}

export default isPlainObject;
