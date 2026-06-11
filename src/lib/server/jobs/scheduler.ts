/**
 * In-process scheduler. Started once from hooks.server.ts.
 *
 * Safe to run on multiple app instances: the evaluator claims checkouts with a
 * single status-guarded `UPDATE … WHERE status = 'active' … RETURNING`, which
 * Postgres serializes row-by-row, so each checkout is claimed (and alerted)
 * exactly once no matter how many instances tick concurrently.
 */
import { evaluateAbandonedCheckouts } from './evaluate';

const TICK_INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startScheduler(): void {
	if (timer) return;
	console.log('Cart Radar scheduler started');
	timer = setInterval(tick, TICK_INTERVAL_MS);
	// Don't hold the process open just for the scheduler
	if (typeof timer.unref === 'function') timer.unref();
	void tick();
}

async function tick(): Promise<void> {
	if (running) return;
	running = true;
	try {
		await evaluateAbandonedCheckouts();
	} catch (err) {
		console.error('Scheduler tick failed:', err);
	} finally {
		running = false;
	}
}
