/**
 * Secret-guarded trigger for the abandonment evaluator, for when scheduling is
 * decoupled from the web process (external cron: Railway cron / QStash / GitHub
 * Actions, etc.). NOT wired up yet — the in-process scheduler (scheduler.ts) is
 * the active trigger. Running both would just double-evaluate, which is safe
 * (claims are exactly-once) but wasteful, so only enable one.
 *
 * Auth: send the CRON_SECRET as `Authorization: Bearer <secret>` or the
 * `x-cron-secret` header. Disabled (401) unless CRON_SECRET is set.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';
import { evaluateAbandonedCheckouts } from '$lib/server/jobs/evaluate';

function authorized(request: Request): boolean {
	const secret = env.CRON_SECRET;
	if (!secret) return false;

	const header = request.headers.get('authorization') ?? '';
	const provided = header.startsWith('Bearer ')
		? header.slice(7)
		: (request.headers.get('x-cron-secret') ?? '');

	// timingSafeEqual requires equal lengths; check first to avoid throwing.
	if (provided.length !== secret.length) return false;
	return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

async function run(request: Request) {
	if (!authorized(request)) error(401, 'Unauthorized');
	const alerted = await evaluateAbandonedCheckouts();
	return json({ ok: true, alerted });
}

// Both verbs supported so any external scheduler can call it.
export const POST: RequestHandler = async ({ request }) => run(request);
export const GET: RequestHandler = async ({ request }) => run(request);
