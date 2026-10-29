<script lang="ts">
	import * as Chart from '#lib/components/ui/chart/index.js';
	import { formatDay, formatNumber } from '#lib/format.ts';
	import { BarChart } from 'layerchart';

	let {
		buckets,
		timeZone,
		color = 'var(--foreground)'
	}: {
		buckets: { start: string; clicks: number }[];
		timeZone: string;
		/** Series colour, e.g. the selected website's accent. */
		color?: string;
	} = $props();

	const config = $derived({
		clicks: { label: 'Leads', color }
	} satisfies Chart.ChartConfig);

	const data = $derived(buckets.map((bucket) => ({ day: bucket.start, clicks: bucket.clicks })));
	// Keep bars slim when there are only a few days; show at most ~8 x-axis labels.
	const bandPadding = $derived(data.length <= 3 ? 0.75 : data.length <= 10 ? 0.55 : 0.35);
	const labelEvery = $derived(Math.max(1, Math.ceil(data.length / 8)));
	const weekdayFormatter = $derived(
		new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' })
	);
</script>

<Chart.Container {config} class="aspect-auto h-64 w-full sm:h-72">
	<BarChart
		{data}
		x="day"
		series={[{ key: 'clicks', label: 'Leads', color: 'var(--color-clicks)' }]}
		{bandPadding}
		padding={{ left: 32, bottom: 24, top: 8, right: 8 }}
		props={{
			bars: { radius: 4, rounded: 'top', fillOpacity: 0.85 },
			xAxis: {
				format: (value: string) => formatDay(value, timeZone),
				ticks: () => data.filter((_, i) => i % labelEvery === 0).map((d) => d.day)
			},
			yAxis: { format: (value: number) => formatNumber(value), ticks: 4 }
		}}
	>
		{#snippet tooltip()}
			<Chart.Tooltip
				indicator="line"
				labelFormatter={(value: string) => weekdayFormatter.format(new Date(value))}
			/>
		{/snippet}
	</BarChart>
</Chart.Container>
