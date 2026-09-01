// @reg Functions

/**
 * Print info. Return content
 */
function info(...args: unknown[]): string {
  callConsoleFn(args, 'info');
  return args.join(' ');
}

/**
 * Print warning
 */
function warn(...args: unknown[]): string {
  callConsoleFn(args, 'warn');
  return args.join(' ');
}

/**
 * Print error
 */
function error(...args: unknown[]): string {
  callConsoleFn(args, 'error');
  return args.join(' ');
}

/**
 * @private
 *
 * Wrap the console function so we don't have to disable eslint repeatedly or
 * for the whole file.
 */
function callConsoleFn(
  args: unknown[],
  fnKey: 'info' | 'warn' | 'error',
): void {
  // eslint-disable-next-line no-console
  return console[fnKey](...args);
}

// @reg Export

export default {
  info,
  warn,
  error,
} as const;
