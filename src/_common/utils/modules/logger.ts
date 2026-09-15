// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// A logger that ignores every message. The API uses it when the `silent`
// option is true.
export const SilentLogger = {
  info: () => {},
  warn: () => {},
} as const satisfies ILogger;

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

/**
 * Where the API sends its messages: `info` for the config file it uses and
 * `warn` for problems such as a marker with no label. By default they're
 * printed to the console; pass your own logger to send them elsewhere, or set
 * the `silent` option to turn them off. Only `info` and `warn` are required,
 * so `console` works too.
 */
export interface ILogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Create a new logger from a partial. Note that SilentLogger sets the defaults.
 *
 * @testOnly
 */
function create(partial: Partial<ILogger>): ILogger {
  return {
    ...SilentLogger,
    ...partial,
  };
}

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
 * Print an empty line.
 */
function line(): void {
  info('');
}

// ============================= Shared Helpers ============================ //

/**
 * Wrap the console function so we don't have to disable eslint repeatedly or
 * for the whole file.
 * 
 * Used by:
 *   {@link info}
 *   {@link warn}
 *   {@link error}
 *
 * @private
 */
function callConsoleFn(
  args: unknown[],
  fnKey: 'info' | 'warn' | 'error',
): void {
  // eslint-disable-next-line no-console
  return console[fnKey](...args);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default {
  info,
  warn,
  error,
  line,
  create,
} as const;
