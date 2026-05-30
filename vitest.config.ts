// vitest.config.ts

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			// mirrors the $lib alias SvelteKit sets up in vite.config.ts
			$lib: path.resolve('./src/lib'),
			'$env/static/public': path.resolve('./src/tests/helpers/env-public-mock.ts')
		}
	},
	test: {
		include: ['src/tests/**/*.test.ts'],
		globals: true,
		environment: 'node',
		// 'forks' gives each test FILE its own OS process → true in-memory DB isolation
		pool: 'forks',
		reporters: ['verbose']
	}
});
