import { format } from 'date-fns';
import { ExecaError } from 'execa';
import chalk from 'chalk';

import git from '#utils/git';

// ========================================================================= //
//                                 Constants                                 //
// ========================================================================= //

const TRUNCATE_BRANCH_NAME_AT_LENGTH = 20;
const CONSOLE_MESSAGE_HEADER = (header: string) => {
  return chalk.bold.white.underline(header);
};

// ========================================================================= //
//                                 Functions                                 //
// ========================================================================= //

/**
 * Entry point
 *
 * Run a git commit but auto generate a message using a human readable
 * timestamp, a basic git stats:
 *
 * Example:
 * Commit changes: [branch feature_branch] | 2026-08-01T16:42:03.512Z | files changed: 3, lines: +47/-12
 */
async function runCommit() {
  try {
    if (await git.main.current()) {
      console.error('This workflow is not allowed on the main branch.');
      process.exit(1);
    }
    // Check if there are uncommitted changes
    const hasChanges = await git.branch.uncommittedChanges.has();
    if (!hasChanges) {
      console.info('Nothing to commit.');
      return;
    }
    // Stage everything and commit changes
    const commitMessage = await getCommitMessage();
    const result = await git.branch.commitRaw(commitMessage);
    if (result) {
      const h1 = CONSOLE_MESSAGE_HEADER('Commit Message:');
      console.log(`\n${h1}`);
      console.info(` • ${commitMessage}`);
      const h2 = CONSOLE_MESSAGE_HEADER('Change Summary [lines changed + filename]:');
      console.log(`\n${h2}`);
      const summary = await git.branch.getLastCommitStatsList();
      const summaryFinal = summary.map((line) => ` • ${line}`).join('\n')
      console.log(summaryFinal + '\n');
    };
    // 
  } catch (err: unknown) {
    const message = err instanceof ExecaError ? getError(err) : err;
    throw message;
  }
}

/**
 * @private
 *
 * Generate a commit message: Timestamp + stats
 */
async function getCommitMessage() {
  const timestamp = format(new Date(), 'M/d/yy h:mma').toLowerCase();
  let branchName = await git.branch.current();
  branchName = truncate(branchName, TRUNCATE_BRANCH_NAME_AT_LENGTH);
  const stats = await git.branch.uncommittedChanges.getStats();
  const { files, insertions, deletions } = stats;
  return `Committed changes: [branch > ${branchName}] | ${timestamp} | files changed: ${files}, lines: +${insertions}/-${deletions}`;
}

/**
 * @private
 *
 * Truncate a string if it exceeds the max length.
 */
function truncate(str: string, maxLength: number) {
  return str.length > maxLength ? str.slice(0, maxLength - 1) + '…' : str;
}

/**
 * @private
 *
 * Print the error message to stderr and set the exit code to 1.
 */
function getError(err: ExecaError): string {
  // const output = err.stderr || err.stdout;
  // console.error(output || err.shortMessage || err.message);
  // process.exitCode = 1;
  return (
    (err.stderr || err.stdout || '')
      .toString()
      .split('\n')
      .find((l: string) => l.includes('→')) ?? err.shortMessage
  );
}

// ========================================================================= //
//                                  Export                                   //
// ========================================================================= //

export default runCommit;
