// src/tests/helpers/env-public-mock.ts
//
// Mock for SvelteKit's $env/static/public — reads from process.env at runtime
// so that tests can use the same env vars without SvelteKit's build pipeline.

export const PUBLIC_LOGO_FILE_NAME = process.env.PUBLIC_LOGO_FILE_NAME ?? '/logo.png';
export const PUBLIC_PROJECT_TITLE = process.env.PUBLIC_PROJECT_TITLE ?? 'Test';
