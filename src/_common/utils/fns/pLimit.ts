// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Create a function that runs the tasks given to it with at most
 * `concurrency` in flight at once. Tasks start in the order they arrive.
 *
 * Don't await another limited task from inside a limited task: when every
 * slot is held by a task waiting on a queued one, nothing can progress.
 */
function pLimit(concurrency: number): Limiter {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be an integer of at least 1');
  }
  let active = 0;
  const queue: (() => void)[] = [];
  const release = () => {
    active--;
    queue.shift()?.();
  };
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        task().then(resolve, reject).finally(release);
      };
      if (active < concurrency) {
        start();
      } else {
        queue.push(start);
      }
    });
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default pLimit;
