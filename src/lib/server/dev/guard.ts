/**
 * Gate for the local testing harness. The dev tools (seed endpoint + /app/dev
 * page) can insert and delete data and flip plan state, so they are opt-in via
 * the DEV_TOOLS env flag and must never be enabled in production.
 */
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export function devToolsEnabled(): boolean {
	return env.DEV_TOOLS === 'true';
}

/** Throws a 404 (hiding the route entirely) unless dev tools are enabled. */
export function assertDevTools(): void {
	if (!devToolsEnabled()) error(404, 'Not found');
}
