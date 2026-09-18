import shell from '@shell';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

// Run inline JS in a child Node process.
const NODE = process.execPath;

let stdout: ReturnType<typeof vi.spyOn>;
let stderr: ReturnType<typeof vi.spyOn>;

/**
 * Everything a spied stream was written to, as one string.
 */
function streamed(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
}

// ========================================================================= //
//                                    TESTS                                  //
// ========================================================================= //

describe('shell', () => {
  describe('default export', () => {
    beforeEach(() => {
      // Keep the child's streamed output out of the test report
      stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should resolve with stdout, minus the trailing newline', async () => {
      const code = 'console.log("line 1"); console.log("line 2")';
      expect(await shell(NODE, ['-e', code])).toBe('line 1\nline 2');
    });

    it('should not include stderr in the result', async () => {
      const code = 'console.log("out"); console.error("err")';
      expect(await shell(NODE, ['-e', code])).toBe('out');
    });

    it('should resolve with an empty string when there is no output', async () => {
      expect(await shell(NODE, ['-e', 'process.exit(0)'])).toBe('');
    });

    it('should stream stdout and stderr as it runs', async () => {
      await shell(NODE, ['-e', 'console.log("out"); console.error("err")']);
      expect(streamed(stdout)).toContain('out');
      expect(streamed(stderr)).toContain('err');
    });

    it('should pass each argument through intact, spaces included', async () => {
      const code = 'console.log(JSON.stringify(process.argv.slice(1)))';
      const result = await shell(NODE, ['-e', code, 'a b', '--x=c d', '']);
      expect(JSON.parse(result)).toEqual(['a b', '--x=c d', '']);
    });

    it('should reject with the exit code when the command fails', async () => {
      await expect(shell(NODE, ['-e', 'process.exit(3)'])).rejects.toThrow(
        /failed with exit code 3/,
      );
    });

    it('should include the full command in the error', async () => {
      await expect(shell(NODE, ['-e', 'process.exit(1)'])).rejects.toThrow(
        `"${NODE} -e process.exit(1)" failed`,
      );
    });

    it('should reject when the command does not exist', async () => {
      await expect(
        shell('code-divider-no-such-command-xyz', []),
      ).rejects.toThrow(/ENOENT/);
    });
  });
});
