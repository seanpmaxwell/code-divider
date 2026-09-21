import type { ILogger } from '@logger';

import type { ExtensionsMap, FilterSettings } from './settings';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

/**
 * What `configureSettings` works out for a run: the resolved target, the
 * config file it used (if any), and the compiled settings.
 */
export interface ConfiguredSettings {
  targetDir: string;
  targetFile: string | null;
  configFilePath: string | null;
  filter: FilterSettings;
  extensionsMap: ExtensionsMap;
}

/**
 * Per-run options shared by the API's internal steps. Built once, then
 * passed down as one object so a new option doesn't change every function
 * signature.
 */
export interface IRunContext extends ConfiguredSettings {
  cwd: string;
  isDryRun: boolean;
  logger: ILogger;
}
