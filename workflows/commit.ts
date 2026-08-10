import { $ } from 'execa';

const COMMIT_MESSAGE = 'Normal development commit';

try {
  await $`git add -A`;
  const { stdout: msg1 } = await $`git commit -m "${COMMIT_MESSAGE}"`;
  console.info(msg1);
  const { stdout: msg2 } = await $`git push`;
  console.info(msg2);
} catch (err) {
  console.error(err);
  process.exit(1);
}
