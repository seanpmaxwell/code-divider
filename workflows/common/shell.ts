import { $ as _$, type TemplateExpression } from 'execa';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

export const $ = _$({ verbose: 'full' });

// Helper for `$$`
const _$$ = _$({ verbose: 'short' });

/**
 * Return string result from shell command.
 */
export async function $$(
  templates: TemplateStringsArray,
  ...expressions: readonly TemplateExpression[]
): Promise<string> {
  const { stdout } = await _$$(templates, ...expressions);
  return stdout.trim();
}
