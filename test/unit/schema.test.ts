import { Ajv } from 'ajv';
import fs from 'fs/promises';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

import DefaultConfig from '@common/constants/DefaultConfig';
import { SCHEMA_URL } from '@common/constants/misc';

// ========================================================================= //
//                                 CONSTANTS                                 //
// ========================================================================= //

const ROOT = path.join(import.meta.dirname, '..', '..');

// ========================================================================= //
//                                  HELPERS                                  //
// ========================================================================= //

let validate: (config: unknown) => boolean;
let errors: () => string;

// ========================================================================= //
//                                   TESTS                                   //
// ========================================================================= //

describe('schema.json', () => {
  beforeAll(async () => {
    const schema = JSON.parse(
      await fs.readFile(path.join(ROOT, 'schema.json'), 'utf8'),
    );
    const ajv = new Ajv({ allErrors: true, strict: true });
    const compiled = ajv.compile(schema);
    validate = (config) => compiled(config);
    errors = () => ajv.errorsText(compiled.errors);
  });

  it('should be identified by the URL that --init writes', async () => {
    const schema = JSON.parse(
      await fs.readFile(path.join(ROOT, 'schema.json'), 'utf8'),
    );
    expect(schema.$id).toBe(SCHEMA_URL);
  });

  it('should pin the major version of package.json in the URL', async () => {
    const pkg = JSON.parse(
      await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'),
    );
    const major = pkg.version.split('.')[0];
    expect(SCHEMA_URL).toBe(
      `https://unpkg.com/code-divider@${major}/schema.json`,
    );
    expect(pkg.files).toContain('schema.json');
  });

  it('should accept the default config, with and without $schema', () => {
    expect(validate(DefaultConfig), errors()).toBe(true);
    expect(validate({ $schema: SCHEMA_URL, ...DefaultConfig }), errors()).toBe(
      true,
    );
  });

  it('should accept partial overrides, a new language and a removed one', () => {
    const config = {
      All: { CharacterLimit: 100, FillerCharacter: '-' },
      Java: { Bookends: ['// ', ' //'] },
      Python: { Extensions: ['py'], Comment: ['# ', ''] },
      Sql: null,
      filter: { exclude: [] },
    };
    expect(validate(config), errors()).toBe(true);
    expect(validate({}), errors()).toBe(true);
  });

  it('should reject the values the runtime validators reject', () => {
    expect(validate({ All: { CharacterLimit: 0 } })).toBe(false);
    expect(validate({ All: { CharacterLimit: '79' } })).toBe(false);
    expect(validate({ All: { FillerCharacter: '==' } })).toBe(false);
    expect(validate({ All: { RegionLabelFormat: 'bold' } })).toBe(false);
    expect(validate({ filter: { include: 'src' } })).toBe(false);
    expect(validate({ JavaScript: { Comment: ['// '] } })).toBe(false);
    expect(validate({ JavaScript: 'js' })).toBe(false);
  });

  it('should flag unknown settings so typos show up in editors', () => {
    expect(validate({ All: { CharLimit: 79 } })).toBe(false);
    expect(validate({ JavaScript: { Extension: ['ts'] } })).toBe(false);
    expect(validate({ filter: { includes: [] } })).toBe(false);
  });
});
