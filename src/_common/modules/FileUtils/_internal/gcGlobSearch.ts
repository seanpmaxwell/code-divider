import type { Dirent, Stats } from 'fs';
import fs from 'fs/promises';
import path from 'path';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

type Usage = 'files' | 'directories' | 'exclude';

// Everything that's constant across a single search.
interface Context {
  file: RegExp;
  dir: RegExp;
  exclude?: RegExp;
  visited: Set<string>;
  matches: Dirent[];
}

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// `**`: in includes, any depth skipping dot-dirs; in excludes, anything.
const DOUBLE_STAR_INCLUDE = '(/[^/.][^/]*)*?';
const DOUBLE_STAR_EXCLUDE = '(/.+?)?';
const RESERVED = /[^\w\s/]/g;
// Case-insensitive on macOS and Windows, like tsc.
const REGEX_FLAGS = ['darwin', 'win32'].includes(process.platform) ? 'i' : '';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * List files using tsconfig-style `include` / `exclude` matching.
 * NOTE: directories are not included.
 *
 * - Patterns are anchored to targetPath ("src" means "./src").
 * - Wildcards: `*`, `?`, and `**` as a whole segment. No `!`, no `[abc]`.
 * - `*`, `?` and `**` in `include` skip dot-prefixed names; spell the dot
 *   out explicitly (e.g. ".github/**\/*") to match them.
 * - A pattern whose last segment has no `.`/`*`/`?` matches recursively.
 * - `exclude` always wins and prunes traversal. Empty `exclude` excludes
 *   nothing; empty `include` includes everything.
 * - Symlinks are followed; cycles and dangling links are skipped.
 */
async function gcGlobSearch(
  include: string[],
  exclude: string[],
  targetPath: string,
): Promise<Dirent[]> {
  const includes = include.length ? include : ['**/*'];
  const ctx: Context = {
    file: buildRegex(includes, 'files'),
    dir: buildRegex(includes, 'directories'),
    exclude: exclude.length ? buildRegex(exclude, 'exclude') : undefined,
    visited: new Set(),
    matches: [],
  };
  await recWalk(ctx, path.resolve(targetPath), '');
  return ctx.matches;
}

/**
 * Recursively walk the directory tree
 *
 * @private {@link gcGlobSearch}
 */
async function recWalk(
  ctx: Context,
  directory: string,
  relative: string,
): Promise<void> {
  const real = await fs.realpath(directory);
  if (ctx.visited.has(real)) return;
  ctx.visited.add(real);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relativePath = `${relative}/${entry.name}`;
    if (ctx.exclude?.test(relativePath)) continue;
    const fullPath = path.join(directory, entry.name);
    const stat = entry.isSymbolicLink() ? await getStats(fullPath) : entry;
    if (!stat) continue;
    if (stat.isFile()) {
      if (ctx.file.test(relativePath)) ctx.matches.push(entry);
    } else if (stat.isDirectory() && ctx.dir.test(relativePath)) {
      await recWalk(ctx, fullPath, relativePath);
    }
  }
}

/**
 * Stat a path, following symlinks. Returns `null` for a dangling link (or
 * anything else that can't be stat'ed) so the caller can skip it.
 *
 * @private {@link recWalk}
 */
function getStats(fullPath: string): Promise<Stats | null> {
  return fs.stat(fullPath).catch(() => null);
}

/**
 * Generate a regex expression.
 *
 * @private {@link gcGlobSearch}
 */
function buildRegex(specs: string[], usage: Usage): RegExp {
  const alternatives = specs
    .map((s) => `(${specToSource(s, usage)})`)
    .join('|');
  const terminator = usage === 'exclude' ? '($|/)' : '$';
  return new RegExp(`^(${alternatives})${terminator}`, REGEX_FLAGS);
}

/**
 * Port of TypeScript's getSubPatternFromSpec, relative to a "/" root.
 *
 * @private {@link buildRegex}
 */
function specToSource(spec: string, usage: Usage): string {
  const isExclude = usage === 'exclude';
  let source = '';
  let optional = 0;
  for (const comp of parseSpec(spec, usage)) {
    if (comp === '**') {
      source += isExclude ? DOUBLE_STAR_EXCLUDE : DOUBLE_STAR_INCLUDE;
      continue;
    }
    // For traversal pruning every trailing segment is optional so that
    // parent directories of a match are still visited.
    if (usage === 'directories') {
      source += '(';
      optional++;
    }
    source += '/' + (isExclude ? escape(comp) : includeSegment(comp));
  }
  return source + ')?'.repeat(optional);
}

/**
 * Validate a spec and split it into path segments, appending the implicit
 * `** /*` when the last segment looks like a directory name.
 *
 * @private {@link specToSource}
 */
function parseSpec(spec: string, usage: Usage): string[] {
  const parts = spec.split(/[\\/]/).filter((c) => c && c !== '.');
  const last = parts.at(-1);
  if (!last) throw new Error(`Empty pattern: "${spec}"`);
  if (parts.includes('..')) {
    throw new Error(`Pattern may not leave the target directory: "${spec}"`);
  }
  if (parts.some((c) => c !== '**' && c.includes('**'))) {
    throw new Error(`"**" must be a whole path segment: "${spec}"`);
  }
  if (usage !== 'exclude' && last === '**') {
    throw new Error(`Include pattern cannot end in "**": "${spec}"`);
  }
  // "src" → "src/**/*"
  return /[.*?]/.test(last) ? parts : [...parts, '**', '*'];
}

/**
 * Turn a path segment into regex source: `*` and `?` become wildcards,
 * every other reserved character is escaped literally.
 *
 * @private {@link specToSource}
 */
function escape(segment: string): string {
  return segment.replace(RESERVED, (c) =>
    c === '*' ? '[^/]*' : c === '?' ? '[^/]' : '\\' + c,
  );
}

/**
 * Include segments: a leading `*`/`?` never matches a dot-prefixed name.
 *
 * @private {@link specToSource}
 */
function includeSegment(comp: string): string {
  if (comp[0] === '*') return '([^./][^/]*)?' + escape(comp.slice(1));
  if (comp[0] === '?') return '[^./]' + escape(comp.slice(1));
  return escape(comp);
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default gcGlobSearch;
