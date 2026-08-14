import { $ } from './common/shell';
import runWorkflow from './common/runWorkflow';

const COMMIT_MESSAGE = 'Normal basic commit';

runWorkflow(import.meta.filename, async () => {
  await $`git add -A`;
  await $`git commit -m "${COMMIT_MESSAGE}"`;
  await $`git push`;
});
