/**
 * Check if the
 */
export function isUsingNode22orAbove() {
  const major = Number(process.versions.node.split('.')[0]);
  return major >= 22;
}
