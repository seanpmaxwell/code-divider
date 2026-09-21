// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

export const CONFIG_FILE_NAME = 'code-divider.config.json';

// Marker tokens written in source files: "// @reg Label", "/* @sec Label */".
// These are fixed and not configurable.
export const Markers = {
  REGION: '@reg',
  SECTION: '@sec',
} as const;

// Written into the config file by `--init` so editors can validate it. The
// major version is pinned; a test checks it matches package.json.
export const SCHEMA_URL = 'https://unpkg.com/code-divider@1/schema.json';
