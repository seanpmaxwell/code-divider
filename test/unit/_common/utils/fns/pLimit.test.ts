import { describe, expect, it } from 'vitest';

import pLimit from '@common/utils/fns/pLimit';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('pLimit', () => {
  it('should never run more tasks than the limit at once', async () => {
    const limit = pLimit(3);
    let active = 0;
    let maxActive = 0;
    const tasks = Array.from({ length: 10 }, (_, i) =>
      limit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await tick();
        active--;
        return i;
      }),
    );
    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(maxActive).toBe(3);
  });

  it('should keep going after a task rejects', async () => {
    const limit = pLimit(1);
    const failing = limit(async () => {
      throw new Error('boom');
    });
    const next = limit(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    expect(await next).toBe('ok');
  });

  it('should reject a bad concurrency value', () => {
    expect(() => pLimit(0)).toThrow();
    expect(() => pLimit(1.5)).toThrow();
  });
});
