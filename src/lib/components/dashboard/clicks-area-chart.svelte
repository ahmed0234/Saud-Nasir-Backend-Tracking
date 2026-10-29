<script lang="ts">
	import * as Chart from '#lib/components/ui/chart/index.js';
	import { formatDay, formatHour, formatNumber } from '#lib/format.ts';
	import { AreaChart } from 'layerchart';

	let {
		buckets,
		unit,
		timeZone,
		color = 'var(--foreground)'
	}: {
		buckets: { start: string; clicks: number }[];
		unit: 'hour' | 'day';
		timeZone: string;
		/** Series colour, e.g. the selected website's accent. */
		color?: string;
	} = $props();

	const config = $derived({
		clicks: { label: 'Leads', color }
	} satisfies Chart.ChartConfig);

	const data = $derived(
		buckets.map((bucket) => ({ date: new Date(bucket.start), clicks: bucket.clicks }))
	);
	const formatTick = (value: Date) =>
		unit === 'hour' ? formatHour(value, timeZone) : formatDay(value, timeZone);
</script>

<Chart.Container {config} class="aspect-auto h-64 w-full sm:h-72">
	<AreaChart
		{data}
		x="date"
		series={[{ key: 'clicks', label: 'Leads', color: 'var(--color-clicks)' }]}
		padding={{ left: 32, bottom: 24, top: 8, right: 8 }}
		props={{
			area: { fillOpacity: 0.1, line: { strokeWidth: 2 } },
			xAxis: { format: formatTick },
			yAxis: { format: (value: number) => formatNumber(value), ticks: 4 },
			highlight: { points: { r: 4, strokeWidth: 2, class: 'stroke-background' } }
		}}
	>
		{#snippet tooltip()}
			<Chart.Tooltip
				indicator="line"
				labelFormatter={(value: Date) =>
					unit === 'hour'
						? formatHour(value, timeZone)
						: new Intl.DateTimeFormat('en-US', {
								timeZone,
								weekday: 'short',
								month: 'short',
								day: 'numeric'
							}).format(value)}
			/>
		{/snippet}
	</AreaChart>
</Chart.Container>
