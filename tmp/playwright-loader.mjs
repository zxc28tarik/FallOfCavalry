import { pathToFileURL } from 'node:url';
import path from 'node:path';

const playwrightUrl = pathToFileURL(path.resolve(process.cwd(), 'node_modules/playwright/index.mjs')).href;

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === 'playwright') {
    return { url: playwrightUrl, shortCircuit: true };
  }
  return defaultResolve(specifier, context, defaultResolve);
}
