import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Handle HOST env var from Shopify CLI
if (
	process.env.HOST &&
	(!process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
	process.env.SHOPIFY_APP_URL = process.env.HOST;
	delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || 'http://localhost').hostname;
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5173;

let hmrConfig;
if (host === 'localhost') {
	hmrConfig = {
		protocol: 'ws' as const,
		host: 'localhost',
		port: 64999,
		clientPort: 64999
	};
} else {
	hmrConfig = {
		protocol: 'wss' as const,
		host: host,
		port: parseInt(process.env.FRONTEND_PORT!) || 8002,
		clientPort: 443
	};
}

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: [host],
		cors: {
			preflightContinue: true
		},
		port,
		host: true,
		hmr: hmrConfig
	}
});
