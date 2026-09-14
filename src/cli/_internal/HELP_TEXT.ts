const HELP_TEXT = `code-divider - format separator / header comment markers

Usage:
  code-divider [options] [path]

Arguments:
  path               File or directory to process (default: current
                      directory). Directories are walked recursively; the
                      default config skips node_modules, .vscode, .idea,
                      .claude, and *.log/*.json files at any depth, plus bin,
                      lib, and dist at the top level. Same as --path.

Options:
  -i, --init [dir]      Write a code-divider.config.json with the default
                        settings into dir (default: current directory).
  -h, --help            Show this help.
  -d, --dry-run         Show what would change without writing any files.
      --check           Like --dry-run, but exit with code 1 if any file
                        would change (for CI and pre-commit hooks).
  -p, --path <value>    File or directory to process.
  -c, --config <value>  Config file to use.
  -v, --version         Show the version.

Markers (rewritten in place, centered and padded to the character limit):
  // @reg Label    Region  -> a 3-line boxed header block.
  // @sec Label    Section -> a single centered header line.

Supported files: JavaScript/TypeScript, Java, CSS, C, C++, Go, Rust, PHP,
Ruby, Python, Bash, SQL (and any others added via code-divider.config.json).`;

export default HELP_TEXT;
