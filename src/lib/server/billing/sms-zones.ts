/**
 * SMS cost zones. Alerts are sent to the MERCHANT's own verified numbers, so a
 * recipient's zone is determined by their country (E.164 prefix). US/Canada SMS
 * is cheap (~$0.013/segment); most international destinations cost 3-5x more, so
 * we price and meter them separately to protect margin.
 */
export type SmsZone = 'domestic' | 'international';

export interface SmsZonePricing {
	/** Per-message price for US/Canada (+1) numbers */
	domestic: number;
	/** Per-message price for all other countries */
	international: number;
}

/**
 * Classify a number by cost zone. Domestic = North American Numbering Plan
 * (+1: US, Canada). Everything else is treated as international.
 * (A handful of +1 Caribbean territories cost more; rare for merchant team
 * numbers, so folded into domestic for v1 — revisit if it shows up in usage.)
 */
export function smsZoneForNumber(e164: string): SmsZone {
	const normalized = e164.replace(/[^\d+]/g, '');
	return normalized.startsWith('+1') ? 'domestic' : 'international';
}
