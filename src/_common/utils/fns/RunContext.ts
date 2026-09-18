import logger, { type ILogger } from '@logger';

import { ExtensionsMap, FilterSettings } from '@common/types/settings';

// ========================================================================= //
//                                   TYPES                                   //
// ========================================================================= //

/**
 * Per-run options shared by the API's internal steps. Passed down as one
 * object so a new option doesn't change every function signature.
 */
export interface IRunContext {
  cwd: string;
  targetPathRaw: string;
  targetDir: string;
  targetFile: string | null;
  isDryRun: boolean;
  logger: ILogger;
  configFilePath: string | null;
  configuredSettings: {
    filter: FilterSettings;
    extensionsMap: ExtensionsMap;
  };
}

// ========================================================================= //
//                                 FUNCTIONS                                 //
// ========================================================================= //

/**
 * Factory-Function: Get an IRunContext object using a partial and default
 * settings.
 */
function RunContext(partial: Partial<IRunContext> = {}): IRunContext {
  return {
    cwd: '',
    targetPathRaw: '',
    targetDir: '',
    targetFile: null,
    isDryRun: false,
    logger,
    configFilePath: null,
    configuredSettings: {
      filter: {
        include: [],
        exclude: [],
      },
      extensionsMap: new Map(),
    },
    ...partial,
  };
}

// ========================================================================= //
//                                  EXPORT                                   //
// ========================================================================= //

export default RunContext;
