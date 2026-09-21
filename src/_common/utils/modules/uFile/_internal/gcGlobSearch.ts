import type { Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import UserError from '@common/utils/classes/UserError';
import pLimit from '@common/utils/fns/pLimit';

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

// Directory reads in flight at once. Subdirectories are walked concurrently,
// so this keeps a huge tree from opening thousands of handles at the same
// time.
const MAX_CONCURRENT_FS_OPS = 32;

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
 * - Symbolic links (to files or folders) are skipped, so the walk never
 *   leaves `targetPath` and cannot loop.
 * - Results are in a stable order: sorted per directory, folders walked in
 *   place (depth first).
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
  const limit = pLimit(MAX_CONCURRENT_FS_OPS);

  // ---- Recursively collect matching files, pruning excluded directories.
  // Symbolic links are neither followed nor listed.
  async function walk(directory: string, relative: string): Promise<Dirent[]> {
    const entries = await limit(() =>
      fs.readdir(directory, { withFileTypes: true }),
    );
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const results: (Dirent | Promise<Dirent[]>)[] = [];
    for (const entry of entries) {
      const relativePath = `${relative}/${entry.name}`;
      if (excludeRegex?.test(relativePath)) continue;
      if (entry.isFile()) {
        if (fileRegex.test(relativePath)) results.push(entry);
      } else if (entry.isDirectory() && dirRegex.test(relativePath)) {
        results.push(walk(path.join(directory, entry.name), relativePath));
      }
    }
    const settled = await Promise.all(results);
    return settled.flat();
  }

  // ---- Walk/Return
  return walk(path.resolve(targetPath), '');
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
    throw new UserError(`Empty pattern: "${spec}"`);
  }
  if (parts.includes('..')) {
    throw new UserError(
      `Pattern may not leave the target directory: "${spec}"`,
    );
  }
  if (parts.some((part) => part !== '**' && part.includes('**'))) {
    throw new UserError(`"**" must be a whole path segment: "${spec}"`);
  }
  if (usage !== 'exclude' && last === '**') {
    throw new UserError(`Include pattern cannot end in "**": "${spec}"`);
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
