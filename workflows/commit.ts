import $ from './common/exec.ts';
import runWorkflow from './common/runWorkflow.ts';


const COMMIT_MESSAGE = 'Normal development commit';

runWorkflow(async () => {
  await $`git add -A`;
  await $`git commit -m "${COMMIT_MESSAGE}"`;
  await $`git push`;
});
