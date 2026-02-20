import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { searchForWorkspaceRoot } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			allow: [
				searchForWorkspaceRoot(process.cwd()),
				resolve(__dirname, '..'),
			],
		},
		proxy: {
			'/api': 'http://localhost:3001',
			'/health': 'http://localhost:3001',
		}
	}
});
