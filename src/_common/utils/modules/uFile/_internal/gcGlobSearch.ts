import type { Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

type Usage = 'files' | 'directories' | 'exclude';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const DOUBLE_STAR_INCLUDE = '(?:/[^/.][^/]*)*?';
const DOUBLE_STAR_EXCLUDE = '(?:/.+?)?';
const RESERVED = /[^\w\s/]/g;

// Case-insensitive on macOS and Windows, like tsc.
const REGEX_FLAGS = ['darwin', 'win32'].includes(process.platform) ? 'i' : '';

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * "gcGlobSearch" => "Giga-Chad Glob Search"
 * List files using tsconfig-style include/exclude matching.
 *
 * - Patterns are anchored to targetPath.
 * - Supports `*`, `?`, and `**` as a whole path segment.
 * - Include wildcards skip leading dots unless explicitly matched.
 * - Directory-like includes expand to recursive file searches.
 * - Excludes match the named path and its descendants, pruning traversal.
 * - Empty include searches recursively; empty exclude excludes nothing.
 * - Symlinks are followed; visited real directories are not revisited.
 * - Symlinks that cannot be stat'ed are skipped.
 */
async function gcGlobSearch(
  include: string[],
  exclude: string[],
  targetPath: string,
): Promise<Dirent[]> {
  const includes = include.length ? include : ['**/*'];
  const fileRegex = buildRegex(includes, 'files');
  const dirRegex = buildRegex(includes, 'directories');
  const excludeRegex = exclude.length
    ? buildRegex(exclude, 'exclude')
    : undefined;
  const visited = new Set<string>();
  const matches: Dirent[] = [];

  // ---- Recursively collect matching files, pruning excluded directories.
  async function walk(directory: string, relative: string): Promise<void> {
    const real = await fs.realpath(directory);
    if (visited.has(real)) return;
    visited.add(real);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relativePath = `${relative}/${entry.name}`;
      if (excludeRegex?.test(relativePath)) continue;
      const fullPath = path.join(directory, entry.name);
      const stat = entry.isSymbolicLink()
        ? await fs.stat(fullPath).catch(() => null)
        : entry;
      if (!stat) continue;
      if (stat.isFile()) {
        if (fileRegex.test(relativePath)) matches.push(entry);
      } else if (stat.isDirectory() && dirRegex.test(relativePath)) {
        await walk(fullPath, relativePath);
      }
    }
  }

  // ---- Walk/Return
  await walk(path.resolve(targetPath), '');
  return matches;
}

/**
 * Compile patterns for file matching, directory traversal, or exclusion.
 *
 * Used by: {@link gcGlobSearch}
 *
 * @private
 */
function buildRegex(specs: string[], usage: Usage): RegExp {
  const isExclude = usage === 'exclude';
  const sources = specs.map((spec) => {
    let source = '';
    let optional = 0;
    for (const segment of parseSpec(spec, usage)) {
      if (segment === '**') {
        source += isExclude ? DOUBLE_STAR_EXCLUDE : DOUBLE_STAR_INCLUDE;
        continue;
      }
      // Make trailing segments optional so parents remain traversable.
      if (usage === 'directories') {
        source += '(?:';
        optional++;
      }
      source += '/' + segmentToSource(segment, isExclude);
    }
    return source + ')?'.repeat(optional);
  });
  // Exclusions also match descendants of a matching path.
  const terminator = isExclude ? '(?:$|/)' : '$';
  return new RegExp(`^(?:${sources.join('|')})${terminator}`, REGEX_FLAGS);
}

/**
 * Validate and split a pattern, expanding directory-like includes.
 *
 * Used by: {@link buildRegex}
 *
 * @private
 */
function parseSpec(spec: string, usage: Usage): string[] {
  const parts = spec.split(/[\\/]/).filter((part) => part && part !== '.');
  const last = parts.at(-1);
  if (!last) {
    throw new Error(`Empty pattern: "${spec}"`);
  }
  if (parts.includes('..')) {
    throw new Error(`Pattern may not leave the target directory: "${spec}"`);
  }
  if (parts.some((part) => part !== '**' && part.includes('**'))) {
    throw new Error(`"**" must be a whole path segment: "${spec}"`);
  }
  if (usage !== 'exclude' && last === '**') {
    throw new Error(`Include pattern cannot end in "**": "${spec}"`);
  }
  // Include "src" → "src/**/*".
  // Exclude "src" stays unchanged so the directory itself is pruned.
  return usage !== 'exclude' && !/[.*?]/.test(last)
    ? [...parts, '**', '*']
    : parts;
}

/**
 * Convert wildcards and escape literal characters within one segment.
 *
 * Used by: {@link buildRegex}
 *
 * @private
 */
function segmentToSource(segment: string, isExclude: boolean): string {
  return segment.replace(RESERVED, (char, index: number) => {
    const leadingIncludeWildcard = !isExclude && index === 0;
    if (char === '*') {
      return leadingIncludeWildcard ? '(?:[^./][^/]*)?' : '[^/]*';
    }
    if (char === '?') {
      return leadingIncludeWildcard ? '[^./]' : '[^/]';
    }
    return '\\' + char;
  });
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default gcGlobSearch;
