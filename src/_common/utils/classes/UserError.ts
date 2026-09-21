// ========================================================================= //
//                                  CLASSES                                  //
// ========================================================================= //

/**
 * An error caused by the user's input (bad flags, a missing path, an invalid
 * config file) rather than by a bug. The CLI prints just the message for
 * these, and the full stack for anything else.
 */
class UserError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UserError';
  }
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default UserError;
