/* eslint-disable no-console */


// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //
// Wrap the logging functions so we can control behavior depending on the
// environment (i.e. unit-testing).
//
// NOTE: this isn't a name space object, we do need call setters on it
// depending on the environment.

/**
 * Print information
 */
function info(...data: Parameters<typeof console.info>): void {
  return console.info(data);
}

/**
 * Print warning.
 */
function warn(...data: Parameters<typeof console.info>): void {
  if (typeof data[0] === 'string' && !data[0].startsWith('Warning')) {
    data[0] = 'Warning: ' + data[0];
  }
  return console.warn(data);
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default {
  info,
  warn,
} as const;
