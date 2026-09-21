import { Markers } from '@common/constants/misc';
import type { IRunContext } from '@common/types/RunContext';
import type { ConfiguredLangSettings } from '@common/types/settings';
import pLimit from '@common/utils/fns/pLimit';

import uFile, { FileCtx } from '@utilm/uFile';

import type { ILogger } from '@logger';

import { escapeRegex } from '../configureSettings/configureSettings';

import formatLabel from './formatLabel';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

// Files processed at once. Starting every file in a huge repo at the same
// time can run into the OS limit on open files (EMFILE).
const MAX_OPEN_FILES = 50;

// Splits a file into lines while keeping each line's own ending.
const RGX_EOL = /(\r\n|\n)/;
const RGX_INDENT = /^\s*/;

// Matchers for dividers that were generated earlier, so they can be brought
// up to date when the settings change. Built once per language.
const dividerRegexCache = new WeakMap<ConfiguredLangSettings, DividerRegexes>();

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

interface DividerRegexes {
  section: RegExp; // [indent, label]
  rule: RegExp; // the top/bottom line of a region block
  middle: RegExp; // [indent, label] the label line of a region block
  fillerOnly: RegExp;
}

interface SplitContent {
  lines: string[];
  eols: string[]; // `eols[i]` follows `lines[i]`; the last line may have none
  defaultEol: string;
}

// The file being edited, mutated in place by the per-line steps.
interface FileEdit extends SplitContent {
  changed: boolean;
}

// Everything the per-line steps need to know about the file being edited.
interface FileJob {
  filePath: string;
  settings: ConfiguredLangSettings;
  regexes: DividerRegexes;
  logger: ILogger;
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Format every file whose extension has a settings object, with at most
 * {@link MAX_OPEN_FILES} in flight at once. Files with no matching language
 * are skipped. Returns the paths of the files that were (or on a dry run,
 * would be) changed, in the same order as `dtos`.
 */
async function applyFormatting(
  dtos: FileCtx[],
  ctx: IRunContext,
): Promise<string[]> {
  const limit = pLimit(MAX_OPEN_FILES);
  const jobs: Promise<string | null>[] = [];
  for (const dto of dtos) {
    const settingsObj = ctx.extensionsMap.get(dto.ext.toLowerCase());
    if (settingsObj) {
      jobs.push(
        limit(() =>
          applyFormattingToOneFile(dto.absolutePath, settingsObj, ctx),
        ),
      );
    }
  }
  const results = await Promise.all(jobs);
  return results.filter((result): result is string => result !== null);
}

/**
 * Insert code-dividers for a file. Each line goes through four steps, in
 * order: a `@sec` marker becomes a section divider, a `@reg` marker becomes a
 * region block, an existing section divider is refreshed, and an existing
 * region block is refreshed. Refreshing rebuilds a divider generated earlier
 * (recognized by the language's bookends and filler) so it reflects the
 * current settings, and only counts as a change when the text differs.
 *
 * Used by: {@link applyFormatting}
 *
 * @private
 */
async function applyFormattingToOneFile(
  fileFullPath: string,
  settingsObj: ConfiguredLangSettings,
  ctx: IRunContext,
): Promise<string | null> {
  // -- Load content -- //
  const content = await uFile.read(fileFullPath);
  if (!mayContainDivider(content, settingsObj)) return null;
  const edit: FileEdit = { ...splitLines(content), changed: false };
  const job: FileJob = {
    filePath: fileFullPath,
    settings: settingsObj,
    regexes: getDividerRegexes(settingsObj),
    logger: ctx.logger,
  };

  // -- Iterate the file line-by-line -- //
  // Each step returns how many extra lines it consumed, so a 3-line region
  // block is skipped over rather than re-inspected.
  for (let i = 0; i < edit.lines.length; i++) {
    const line = edit.lines[i];
    const sectionMarker = line.match(settingsObj.SECTION_MARKER);
    if (sectionMarker) {
      insertSectionAt(edit, i, sectionMarker[1], job);
      continue;
    }
    const regionMarker = line.match(settingsObj.REGION_MARKER);
    if (regionMarker) {
      i += insertRegionAt(edit, i, regionMarker[1], job);
      continue;
    }
    if (refreshSectionAt(edit, i, job)) continue;
    i += refreshRegionAt(edit, i, job);
  }

  // -- Return -- //
  // Return the path if the file WAS edited, null if nothing changed
  if (!edit.changed) return null;
  if (!ctx.isDryRun) {
    await uFile.write(fileFullPath, joinLines(edit.lines, edit.eols));
  }
  return fileFullPath;
}

// ============================= Per-line Steps ============================ //

/**
 * Step 1: replace a `@sec` marker line with a section divider. A marker with
 * no label is warned about and left alone.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function insertSectionAt(
  edit: FileEdit,
  i: number,
  rawLabel: string | undefined,
  job: FileJob,
): void {
  const label = validateLabel(rawLabel, job.filePath, i, job.logger);
  if (!label) return;
  edit.lines[i] = buildSection(label, job.settings, getIndent(edit.lines[i]));
  edit.changed = true;
}

/**
 * Step 2: replace a `@reg` marker line with a 3-line region block. The two
 * added lines take the marker line's own line ending. Returns the number of
 * extra lines now occupying the spot (2), or 0 if the marker had no label.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function insertRegionAt(
  edit: FileEdit,
  i: number,
  rawLabel: string | undefined,
  job: FileJob,
): number {
  const label = validateLabel(rawLabel, job.filePath, i, job.logger);
  if (!label) return 0;
  const block = buildRegion(label, job.settings, getIndent(edit.lines[i]));
  const eol = edit.eols[i] ?? edit.defaultEol;
  edit.lines.splice(i, 1, ...block);
  edit.eols.splice(i, 0, eol, eol);
  edit.changed = true;
  return 2;
}

/**
 * Step 3: rebuild an existing section divider with the current settings.
 * Returns whether the line was a section divider at all (changed or not).
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function refreshSectionAt(edit: FileEdit, i: number, job: FileJob): boolean {
  const line = edit.lines[i];
  const match = line.match(job.regexes.section);
  if (!match) return false;
  const [, indent, label] = match;
  const rebuilt = buildSection(label, job.settings, indent);
  if (rebuilt !== line) {
    edit.lines[i] = rebuilt;
    edit.changed = true;
  }
  return true;
}

/**
 * Step 4: rebuild an existing region block with the current settings. A block
 * is two identical rule lines around a label line of the same width and
 * indentation; the width check keeps hand-written comment boxes untouched.
 * Returns the number of extra lines the block occupies (2), or 0 if the
 * current line doesn't start one.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function refreshRegionAt(edit: FileEdit, i: number, job: FileJob): number {
  const { lines } = edit;
  const { regexes } = job;
  const rule = lines[i];
  if (i + 2 >= lines.length || lines[i + 2] !== rule) return 0;
  if (!regexes.rule.test(rule)) return 0;
  const middle = lines[i + 1].match(regexes.middle);
  const label = middle?.[2].trim() ?? '';
  if (
    !middle ||
    !label ||
    regexes.fillerOnly.test(label) ||
    middle[1] !== getIndent(rule) ||
    lines[i + 1].length !== rule.length
  ) {
    return 0;
  }
  const block = buildRegion(label, job.settings, middle[1]);
  if (block[0] !== rule || block[1] !== lines[i + 1]) {
    lines.splice(i, 3, ...block);
    edit.changed = true;
  }
  return 2;
}

// ============================= Shared Helpers ============================ //

/**
 * Cheap check before splitting a file into lines: a file can only need work
 * if it contains a marker or something that looks like a generated divider
 * (the opening bookend followed by the filler character).
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function mayContainDivider(
  content: string,
  settingsObj: ConfiguredLangSettings,
): boolean {
  return (
    content.includes(Markers.REGION) ||
    content.includes(Markers.SECTION) ||
    content.includes(settingsObj.BOOKENDS[0] + settingsObj.FILLER)
  );
}

/**
 * Split `content` into lines, remembering each line's own ending so a file
 * with mixed endings is written back exactly as it was.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function splitLines(content: string): SplitContent {
  const parts = content.split(RGX_EOL);
  const lines: string[] = [];
  const eols: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) lines.push(parts[i]);
    else eols.push(parts[i]);
  }
  return { lines, eols, defaultEol: eols[0] ?? '\n' };
}

/**
 * Inverse of {@link splitLines}.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function joinLines(lines: string[], eols: string[]): string {
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    out += lines[i] + (eols[i] ?? '');
  }
  return out;
}

/**
 * Leading whitespace of a line.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function getIndent(line: string): string {
  return line.match(RGX_INDENT)?.[0] ?? '';
}

/**
 * Build (and cache) the matchers for dividers generated with a language's
 * current bookends and filler.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function getDividerRegexes(
  settingsObj: ConfiguredLangSettings,
): DividerRegexes {
  let regexes = dividerRegexCache.get(settingsObj);
  if (!regexes) {
    const [open, close] = settingsObj.BOOKENDS.map(escapeRegex);
    const filler = escapeRegex(settingsObj.FILLER);
    regexes = {
      section: new RegExp(`^(\\s*)${open}${filler}+ (.+?) ${filler}+${close}$`),
      rule: new RegExp(`^\\s*${open}${filler}+${close}$`),
      middle: new RegExp(`^(\\s*)${open}(.*)${close}$`),
      fillerOnly: new RegExp(`^${filler}+$`),
    };
    dividerRegexCache.set(settingsObj, regexes);
  }
  return regexes;
}

/**
 * Double-check the label is truthy after trimming.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function validateLabel(
  label: string | undefined,
  filePath: string,
  lineNum: number,
  logger: ILogger,
): string {
  const labelNew = label?.trim() ?? '';
  if (!labelNew) {
    logger.warn(
      `Warning: ${filePath}:${lineNum + 1}: code-divider marker has no label, skipping`,
    );
  }
  return labelNew;
}

/**
 * Build a single-line section header centered within `[open] = label = [close]`.
 * Filler fills up to the character limit and stops; a label too long to fit
 * simply gets no filler rather than pushing the line past the limit.
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function buildSection(
  rawLabel: string,
  langConfig: ConfiguredLangSettings,
  indent: string,
): string {
  const label = formatLabel(rawLabel, langConfig.SECTION_LABEL_FORMAT);
  const [open, close] = langConfig.BOOKENDS;
  const filler = langConfig.FILLER;
  const lineLen = langConfig.CHAR_LIMIT - indent.length;
  const available = lineLen - open.length - close.length - label.length - 2;
  const left = Math.max(Math.ceil(available / 2), 0);
  const right = Math.max(Math.floor(available / 2), 0);
  return `${indent}${open}${filler.repeat(left)} ${label} ${filler.repeat(right)}${close}`;
}

/**
 * Build a 3-line region header block with the label centered on the middle
 * line. Rule lines stop at the character limit: "// " + filler + " //".
 *
 * Used by: {@link applyFormattingToOneFile}
 *
 * @private
 */
function buildRegion(
  rawLabel: string,
  langConfig: ConfiguredLangSettings,
  indent: string,
): [string, string, string] {
  const label = formatLabel(rawLabel, langConfig.REGION_LABEL_FORMAT);
  const [open, close] = langConfig.BOOKENDS;
  const lineLen = langConfig.CHAR_LIMIT - indent.length;
  const inner = Math.max(lineLen - open.length - close.length, 0);
  const rule = indent + open + langConfig.FILLER.repeat(inner) + close;
  const leftPad = Math.max(Math.floor((inner - label.length) / 2), 0);
  const rightPad = Math.max(inner - label.length - leftPad, 0);
  const middle =
    indent + open + ' '.repeat(leftPad) + label + ' '.repeat(rightPad) + close;
  return [rule, middle, rule];
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default applyFormatting;
