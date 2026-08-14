import { $, $$ } from "./shell";

const MAIN_BRANCH = 'main';

/**
 * Commit changes but don't error if nothing to commit.
 */
export async function commitChanges(message = 'fallback commit message') {
    if (await isClean()) {
        console.info('Skipping commit, branch is clean');
        return;
    }
    await $`git add -A`;
    await $`git commit -m ${message}`;
}

/**
 * Check if a branch is "clean" (has no uncommitted changes)
 */
export async function isClean(): Promise<boolean> {
    const resp = await $$`git status --porcelain`;
    return resp.length > 0;
}

/**
 * Check if a branch is "dirty" (has uncommitted changes)
 */
export async function isDirty(): Promise<boolean> {
    return !(await isClean());
}

/**
 * Get the name of the current branch
 */
export function getCurrentBranch(): Promise<string> {
    return $$`git branch --show-current`;
}

/**
 * Check if currently on the main branch
 */
export async function getIsMainActive(): Promise<boolean> {
    const currentBranch = await getCurrentBranch();
    return currentBranch === MAIN_BRANCH;
}

/**
 * If not currently on the main branch, backup changes and navigate to it.
 */
export async function checkoutToMain() {
    const onMainBranch = await getIsCheckedOutToMain();
    if (!onMainBranch) {
        await commitChanges('Backup before switching to main');
        await $`git checkout ${MAIN_BRANCH}`;
    } else {
        console.info(`Already on "${MAIN_BRANCH}"`);
    }
}

/**
 * Reset the currently checked out branch to its origin.
 */
export async function resetToOrigin(): Promise<void> {
    const currentBranch = await getCurrentBranch();
    await $`git fetch origin`;
    return $`git reset --hard origin/${currentBranch}`;
}
