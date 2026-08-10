import { $ } from 'execa';

const COMMIT_MESSAGE = 'Normal development commit';

try {
  await $`git add -A`;
  await $`git commit -m "${COMMIT_MESSAGE}"`;
  await $`git push`;
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}
