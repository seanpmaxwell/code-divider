import { UNIT_TEST_ENV } from '../constants/misc';
import { CallableKeys } from '../types/utility-types';

// ========================================================================= //
//                                    Types                                  //
// ========================================================================= //

type Console = typeof console;
type ConsoleFnKeys = CallableKeys<Console>;
type ConsoleFn<Fn extends ConsoleFnKeys> = Console[Fn];

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
function info(...data: Parameters<Console['info']>): string {
  return logAction('info', data);
}

/**
 * Print warning.
 */
function warn(...data: Parameters<Console['warn']>): void {
  return console.warn(data);
}

/**
 * @private
 *
 * Return the string if in a unit-testing environment.
 */
function logAction<T extends ConsoleFnKeys>(
  action: T,
  ...data: Parameters<ConsoleFn<T>>
): string {
  const isTesting = (process.env.NODE_ENV = UNIT_TEST_ENV);
  if (isTesting) {
    let dataFinal: string;
    if (Array.isArray(data)) {
      dataFinal = data.map(item => String(item)).join(' ');
    } else {
      dataFinal = String(data);
    }
    return dataFinal;
  } else {
    console[action](...data);
    return '';
  }
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default {
  info,
  warn,
} as const;
