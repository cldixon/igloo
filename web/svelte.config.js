import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			'@igloo/shared': '../src/shared/index.ts'
		}
	}
};

export default config;
