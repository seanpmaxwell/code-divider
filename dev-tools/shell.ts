import { spawn } from 'child_process';
import { createRequire } from 'module';
import path from 'path';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const require = createRequire(import.meta.url);

// Commands whose package is not named after them.
const BIN_PACKAGES: Record<string, string> = {
  tsc: 'typescript',
  tsserver: 'typescript',
};

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Run a command and resolve with its stdout (without the trailing newline).
 * Output is also streamed to this process as it happens. Uses the built-in
 * `child_process`, so it works on every supported Node version. Pass each
 * argument separately.
 *
 * A command provided by an installed package (`tsc`, `dts-bundle-generator`)
 * is run as `node <its script>`, which works on every OS. Anything else is
 * spawned as given, without a shell, except that on Windows a bare name such
 * as `npm` resolves to an `npm.cmd` shim that only the shell can start, so
 * those go through `cmd.exe` with each argument quoted.
 *
 * Rejects if the command can't be started or exits with a non-zero code.
 */
function shell(cmd: string, args: string[]): Promise<string> {
  const script = isBareCommand(cmd) ? findLocalBin(cmd) : null;
  const useShell =
    !script && process.platform === 'win32' && isBareCommand(cmd);
  const file = script ? process.execPath : cmd;
  let finalArgs = script ? [script, ...args] : args;
  if (useShell) finalArgs = finalArgs.map(quoteForCmdExe);
  return new Promise((resolve, reject) => {
    const child = spawn(file, finalArgs, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: useShell,
    });
    // Decode as UTF-8 so a character split across chunks isn't mangled
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let stdout = '';
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      process.stderr.write(chunk);
    });
    // e.g. the command doesn't exist (ENOENT)
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve(stdout.replace(/\r?\n$/, ''));
        return;
      }
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`"${[cmd, ...args].join(' ')}" failed with ${reason}`));
    });
  });
}

// ============================= Shared Helpers ============================ //

/**
 * Absolute path to the JavaScript entry point of a command provided by an
 * installed package, read from the `bin` field of its package.json, or
 * `null` when no installed package provides it. Spawning the command by name
 * would fail on Windows, where npm installs commands as `.cmd` shims.
 *
 * Used by: {@link shell}
 *
 * @private
 */
function findLocalBin(cmd: string): string | null {
  const pkg = BIN_PACKAGES[cmd] ?? cmd;
  let pkgJsonPath: string;
  try {
    pkgJsonPath = require.resolve(`${pkg}/package.json`);
  } catch {
    return null;
  }
  const { bin } = require(pkgJsonPath) as {
    bin?: string | Record<string, string>;
  };
  const rel = typeof bin === 'string' ? bin : bin?.[cmd];
  return rel ? path.join(path.dirname(pkgJsonPath), rel) : null;
}

/**
 * A command given by name only (`npm`), as opposed to a path (`./x.exe`,
 * `C:\\node.exe`).
 *
 * Used by: {@link shell}
 *
 * @private
 */
function isBareCommand(cmd: string): boolean {
  return !path.isAbsolute(cmd) && !/[\\/]/.test(cmd);
}

/**
 * Quote one argument for cmd.exe: wrap in double quotes when it contains
 * whitespace or quotes, doubling any embedded quotes.
 *
 * Used by: {@link shell}
 *
 * @private
 */
function quoteForCmdExe(arg: string): string {
  if (arg !== '' && !/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default shell;
