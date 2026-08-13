import { logger } from "#src/index.js";

// ========================================================================= //
//                                    Functions                              //
// ========================================================================= //

/**
 * Run workflow
 */
async function runWorkflow(
  workflowName: string,
  cb: () => Promise<void>,
  onError?: (err?: unknown) => Promise<void>,
): Promise<void> {
  try {
    logger.info('Running workflow ' + workflowName);
    await cb();
    logger.info('Running workflow ' + workflowName);
  } catch (err) {
    onError?.(err);
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
}

// ========================================================================= //
//                                    Export                                 //
// ========================================================================= //

export default runWorkflow;
