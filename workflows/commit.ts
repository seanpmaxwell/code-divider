import { $ } from './common/shell';
import runWorkflow from './common/runWorkflow';

const COMMIT_MESSAGE = 'Normal development commit';

runWorkflow('basic-commit', async () => {
  await $`git add -A`;
  await $`git commit -m "${COMMIT_MESSAGE}"`;
  await $`git push`;
});
