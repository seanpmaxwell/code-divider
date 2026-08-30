# code-divider

[![CI](https://github.com/seanpmaxwell/code-divider/actions/workflows/ci.yml/badge.svg)](https://github.com/seanpmaxwell/code-divider/actions/workflows/ci.yml)

Command-line tool to insert divider/header comments in your source files so labels are centered and each line fills up to a character limit.

## Preview

For example, this:

```js
// @reg Functions
```

becomes:

```js
// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //
```

## Usage

```bash
npx code-divider [options] [paths...]
```

If no paths are given, the current directory is walked recursively (skipping `node_modules` and dotfiles).

### Options

| Option            | Description                                         |
| ----------------- | --------------------------------------------------- |
| `-n`, `--dry-run` | Show what files would change without writing files. |
| `-h`, `--help`    | Show help.                                          |
| `-v`, `--version` | Show the version.                                   |

## Markers

Write a marker on its own line and `code-divider` rewrites it in place:

| Marker          | Result                                       |
| --------------- | -------------------------------------------- |
| `// @reg Label` | **Region** — a 3-line boxed header block.    |
| `// @sec Label` | **Section** — a single centered header line. |

Supported files: JavaScript/TypeScript, Java, CSS/SCSS, C, C++, Go, Rust, PHP, Ruby, and SQL — and any others you add via configuration.

## Auto-Run on save

This is how I use code-divider and what saved me tons of time. Using your IDE of choice, open up the run on save options and have code-divider execute for your directory automatically. Below is an example using VSCode (requires the `https://github.com/emeraldwalk/vscode-runonsave`)

```json
"emeraldwalk.runonsave": {
  "commands": [
    {
      "match": "\\.(css|js|jsx|ts|tsx)$",
      "cmd": "npx code-divider"
    }
  ]
}
```

## Terminology

Given the source line `// @sec My Section`, code-divider produces:

```
// ============== My Section ============== //
```

The parts of that output are named as follows:

| Term             | Refers to                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Marker           | The token you write to request a divider: `@reg` (region) or `@sec` (section).            |
| Comment          | What starts a comment for the marker — `//` here; the syntax the marker is written in.    |
| Label            | The text after the marker (`My Section`), centered as the title of the divider.           |
| Filler character | The repeated character that pads the line out to the limit (`=` above).                   |
| Bookends         | The strings wrapping each generated line — here `// ` on the left and ` //` on the right. |

## Configuration

`code-divider` works out of the box — you only need a config file if you want to override the default settings.

To do so, add a `code-divider.config.json`. `code-divider` looks for it in the target path's directory first, then falls back to the directory it is run from (nearest wins — the two are not merged). Any values in it override the corresponding defaults; everything else keeps its default.

The `All` key holds settings shared by every language. Every other top-level key is a language — unknown keys define new languages.

| `All` field          | Meaning                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `CharacterLimit`     | Column the header lines fill up to and stop at. Defaults to `79`.                                         |
| `FillerCharacter`    | Character the header lines are padded with. Defaults to `"="`.                                            |
| `RegionLabelFormat`  | How `@reg` labels are cased: `uppercase`, `lowercase`, `capitalize`, or `none`. Defaults to `uppercase`.  |
| `SectionLabelFormat` | How `@sec` labels are cased: `uppercase`, `lowercase`, `capitalize`, or `none`. Defaults to `capitalize`. |

> By default, region labels (`@reg`) are UPPERCASED and section labels (`@sec`) are capitalized (first letter upper, the rest lower) — so `// @reg my cool region` becomes a **MY COOL REGION** header and `// @sec my cool section` becomes a **My Cool Section** header. Set `RegionLabelFormat`/`SectionLabelFormat` to `lowercase` or `none` to change or skip this; regardless of the setting, words that start or end with a non-alphanumeric character are always left exactly as written (e.g. `@decorator`, `foo()`).

Each language can be configured individually via the `code-divider.config.json` file:

| Language field       | Meaning                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `Extensions`         | File extensions to match, e.g. `["py"]`.                                        |
| `Comment`            | Comment open/close the markers are written in; close is `""` for line comments. |
| `Bookends`           | Optional. Start/end of generated header lines. Defaults to the comment syntax.  |
| `CharacterLimit`     | Optional. Overrides `All.CharacterLimit` for this language.                     |
| `FillerCharacter`    | Optional. Overrides `All.FillerCharacter` for this language.                    |
| `RegionLabelFormat`  | Optional. Overrides `All.RegionLabelFormat` for this language.                  |
| `SectionLabelFormat` | Optional. Overrides `All.SectionLabelFormat` for this language.                 |

```json
{
  "All": {
    "CharacterLimit": 100,
    "FillerCharacter": "-"
  },
  "Java": {
    "Bookends": ["/* ", " */"]
  },
  "Python": {
    "Extensions": ["py"],
    "Comment": ["# ", ""]
  }
}
```

> With that config, `# @reg Label` in a `.py` file becomes a boxed header block whose rule lines are padded with `-` and fill up to 100 characters.

Built-in languages and their defaults:

| Key          | Files                         | Markers written as | Bookends      |
| ------------ | ----------------------------- | ------------------ | ------------- |
| `JavaScript` | `.js .jsx .ts .tsx .mjs .cjs` | `// @reg Label`    | `// ` … ` //` |
| `Java`       | `.java`                       | `// @reg Label`    | `// ` … ` //` |
| `Css`        | `.css .scss`                  | `/* @reg Label */` | `/* ` … ` */` |
| `C`          | `.c .h`                       | `// @reg Label`    | `// ` … ` //` |
| `Cpp`        | `.cpp .cc .cxx .hpp .hh .hxx` | `// @reg Label`    | `// ` … ` //` |
| `Go`         | `.go`                         | `// @reg Label`    | `// ` … ` //` |
| `Rust`       | `.rs`                         | `// @reg Label`    | `// ` … ` //` |
| `Php`        | `.php`                        | `// @reg Label`    | `// ` … ` //` |
| `Ruby`       | `.rb`                         | `# @reg Label`     | `# ` … ` #`   |
| `Python`     | `.py .pyi .pyw`               | `# @reg Label`     | `# ` … ` #`   |
| `Bash`       | `.sh .bash`                   | `# @reg Label`     | `# ` … ` #`   |
| `Sql`        | `.sql`                        | `-- @reg Label`    | `-- ` … ` --` |

Rather than writing the file from scratch, you can generate one pre-filled with all the default settings and edit from there:

```bash
npx code-divider init
```

This writes a `code-divider.config.json` to the current directory (it refuses to overwrite an existing one).

## Programmatic use

```js
import insertdividers from 'code-divider';

insertdividers('src');
```

## License

MIT
