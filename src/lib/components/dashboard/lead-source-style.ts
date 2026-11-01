import type { LeadSource } from '#lib/traffic-source.ts';

// One visual identity per lead source, shared by the badges and the "Lead sources" bars so a
// source looks the same everywhere. Brand colours where the platform has one.

export type LeadSourceStyle = {
	/** Filled icon tile (badge dot, list icon). */
	tile: string;
	/** Badge chip: tinted background, text and ring. */
	chip: string;
	/** Bar fill. */
	bar: string;
};

export const LEAD_SOURCE_STYLES: Record<LeadSource, LeadSourceStyle> = {
	organic: {
		tile: 'bg-green-600 text-white',
		chip: 'bg-green-600/10 text-green-800 ring-green-600/25 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-400/25',
		bar: 'bg-linear-to-r from-green-500 to-green-600'
	},
	yelp: {
		tile: 'bg-[#d32323] text-white',
		chip: 'bg-[#d32323]/10 text-[#a51b1b] ring-[#d32323]/25 dark:bg-[#d32323]/20 dark:text-red-300 dark:ring-red-400/25',
		bar: 'bg-linear-to-r from-[#e8453c] to-[#d32323]'
	},
	instagram: {
		tile: 'bg-linear-to-tr from-[#f9a03f] via-[#e1306c] to-[#833ab4] text-white',
		chip: 'bg-[#e1306c]/10 text-[#b0245a] ring-[#e1306c]/25 dark:bg-[#e1306c]/20 dark:text-pink-300 dark:ring-pink-400/25',
		bar: 'bg-linear-to-r from-[#f9a03f] via-[#e1306c] to-[#833ab4]'
	},
	facebook: {
		tile: 'bg-[#1877f2] text-white',
		chip: 'bg-[#1877f2]/10 text-[#125ec2] ring-[#1877f2]/25 dark:bg-[#1877f2]/20 dark:text-blue-300 dark:ring-blue-400/25',
		bar: 'bg-linear-to-r from-[#4b95f5] to-[#1877f2]'
	},
	google_business_profile: {
		tile: 'bg-[#fbbc04] text-[#3c2a00]',
		chip: 'bg-[#fbbc04]/15 text-[#7a5a00] ring-[#e3a800]/35 dark:bg-[#fbbc04]/15 dark:text-amber-200 dark:ring-amber-300/25',
		bar: 'bg-linear-to-r from-[#fcd04f] to-[#f4a700]'
	},
	ai: {
		tile: 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white',
		chip: 'bg-violet-500/10 text-violet-800 ring-violet-500/25 dark:bg-violet-500/20 dark:text-violet-300 dark:ring-violet-400/25',
		bar: 'bg-linear-to-r from-violet-500 to-fuchsia-500'
	}
};
