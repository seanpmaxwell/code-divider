import { $ as $$ } from 'execa';


/**
 * Print execa commands
 */
export const $ = $$({
  verbose: (verboseLine: string) => {
    // eslint-disable-next-line no-console
    console.info(verboseLine, '\n');
  },
});

/**
 * Run workflow
 */
export async function runWorkflow(
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
