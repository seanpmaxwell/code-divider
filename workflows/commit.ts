/* eslint-disable no-console */
import { $ as $$ } from 'execa';

const COMMIT_MESSAGE = 'Normal development commit';
const $ = $$({ verbose: 'short' });

try {
  await $`git add -A`;
  await $`git commit -m "${COMMIT_MESSAGE}"`;
  await $`git push`;
  console.info('Commit and push done');
} catch (err) {
  console.error(err);
  process.exit(1);
}
