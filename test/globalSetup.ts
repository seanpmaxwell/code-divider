import type { TestProject } from 'vitest/node';
import { UNIT_TEST_ENV } from '../src/common/constants/misc';

let project: TestProject;

/**
 * Runs before all tests
 */
export async function setup(prj: TestProject) {
  prj.provide('prevNodeEnv', process.env.NODE_ENV);
  process.env.NODE_ENV = UNIT_TEST_ENV;
  project = prj;
}

/**
 * Runs after all tests.
 */
export async function teardown() {
  const ctx = project.getProvidedContext();
  process.env.NODE_ENV = ctx.prevNodeEnv;
}
