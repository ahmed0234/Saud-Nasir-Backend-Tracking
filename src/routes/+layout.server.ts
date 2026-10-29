import { resolveTimeZone, TIME_ZONE_COOKIE } from '#lib/timezone.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ cookies }) => {
	return { timeZone: resolveTimeZone(cookies.get(TIME_ZONE_COOKIE)) };
};
