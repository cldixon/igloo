import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// The app is client-rendered (ssr = false), so it ships as a SPA and is
		// served by Workers Static Assets. Deep links resolve via the
		// not_found_handling = "single-page-application" fallback.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		}),
		alias: {
			'@igloo/shared': '../src/shared/index.ts'
		}
	}
};

export default config;
