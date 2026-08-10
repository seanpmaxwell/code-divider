import { $ } from 'execa';

const COMMIT_MESSAGE = 'Normal development commit';


await $`git add -A`;
await $`git commit -m "${COMMIT_MESSAGE}"`;

await $`git push`;
