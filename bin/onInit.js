// ========================================================================= //
//                                    Functions                              //
// ========================================================================= //

/**
 * For logic that needs to be run when a file loads. 
 */
async function onInit(cb) {
  try {
    return await cb();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`onInit failed:`, err);
    throw err; // rethrow
  }
}

// ========================================================================= //
//                                    Export                                 //
// ========================================================================= //

export default onInit;
