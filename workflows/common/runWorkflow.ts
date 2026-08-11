

/**
 * Run workflow
 */
async function runWorkflow(
  workflowName: string,
  cb: () => Promise<void>,
  onError?: (err?: unknown) => Promise<void>,
): Promise<void> {
  try {
    
    await cb();
  } catch (err) {
    onError?.(err);
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
}

export default runWorkflow;
