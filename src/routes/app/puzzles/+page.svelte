<script lang="ts">
	import { onMount } from 'svelte';

	interface Puzzle {
		id: string;
		name: string;
		pieces: number;
		created: string;
		status: 'active' | 'draft';
		image: string;
	}

	// Mock data - replace with actual API call
	const mockPuzzles: Puzzle[] = [
		{
			id: '1',
			name: 'Mountain View',
			pieces: 16,
			created: 'Today',
			status: 'active',
			image: 'https://picsum.photos/id/29/80/80'
		},
		{
			id: '2',
			name: 'Ocean Sunset',
			pieces: 9,
			created: 'Yesterday',
			status: 'active',
			image: 'https://picsum.photos/id/12/80/80'
		},
		{
			id: '3',
			name: 'Forest Animals',
			pieces: 25,
			created: 'Last week',
			status: 'draft',
			image: 'https://picsum.photos/id/324/80/80'
		},
		{
			id: '4',
			name: 'City Skyline',
			pieces: 36,
			created: 'Last week',
			status: 'active',
			image: 'https://picsum.photos/id/1067/80/80'
		},
		{
			id: '5',
			name: 'Desert Dunes',
			pieces: 16,
			created: '2 weeks ago',
			status: 'draft',
			image: 'https://picsum.photos/id/1035/80/80'
		}
	];

	let puzzles = $state<Puzzle[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		// Simulate API loading
		await new Promise((resolve) => setTimeout(resolve, 800));
		puzzles = mockPuzzles;
		isLoading = false;
	});

	function getStatusTone(status: string): string {
		return status === 'active' ? 'success' : 'neutral';
	}

	function formatStatus(status: string): string {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}
</script>

<svelte:head>
	<title>Puzzles</title>
</svelte:head>

<s-page heading="Puzzles">
	<s-button slot="primary-action" variant="primary">Create puzzle</s-button>
	<s-button slot="secondary-actions" variant="secondary">Export puzzles</s-button>
	<s-button slot="secondary-actions" variant="secondary">Import puzzles</s-button>

	{#if error}
		<s-banner tone="critical" heading="Error loading puzzles">
			{error}
		</s-banner>
	{/if}

	{#if isLoading}
		<s-box border="base" borderRadius="base" background="base">
			<s-grid placeContent="center center" padding="large-500" minBlockSize="300px">
				<s-stack alignItems="center" gap="base">
					<s-spinner accessibilityLabel="Loading puzzles" size="large"></s-spinner>
					<s-text>Loading puzzles...</s-text>
				</s-stack>
			</s-grid>
		</s-box>
	{:else if puzzles.length > 0}
		<!-- Table -->
		<s-section padding="none" accessibilityLabel="Puzzles table section">
			<s-table>
				<s-table-header-row>
					<s-table-header listSlot="primary">Puzzle</s-table-header>
					<s-table-header format="numeric">Pieces</s-table-header>
					<s-table-header>Created</s-table-header>
					<s-table-header listSlot="secondary">Status</s-table-header>
				</s-table-header-row>
				<s-table-body>
					{#each puzzles as puzzle (puzzle.id)}
						<s-table-row>
							<s-table-cell>
								<s-stack direction="inline" gap="small" alignItems="center">
									<s-clickable
										href="/app/puzzles/{puzzle.id}"
										accessibilityLabel="{puzzle.name} puzzle thumbnail"
										border="base"
										borderRadius="base"
										overflow="hidden"
										inlineSize="40px"
										blockSize="40px"
									>
										<s-image
											objectFit="cover"
											alt="{puzzle.name} puzzle thumbnail"
											src={puzzle.image}
										></s-image>
									</s-clickable>
									<s-link href="/app/puzzles/{puzzle.id}">{puzzle.name}</s-link>
								</s-stack>
							</s-table-cell>
							<s-table-cell>{puzzle.pieces}</s-table-cell>
							<s-table-cell>{puzzle.created}</s-table-cell>
							<s-table-cell>
								<s-badge color="base" tone={getStatusTone(puzzle.status)}>
									{formatStatus(puzzle.status)}
								</s-badge>
							</s-table-cell>
						</s-table-row>
					{/each}
				</s-table-body>
			</s-table>
		</s-section>
	{:else}
		<!-- Empty state -->
		<s-section accessibilityLabel="Empty state section">
			<s-grid gap="base" justifyItems="center" paddingBlock="large-400">
				<s-box maxInlineSize="200px" maxBlockSize="200px">
					<s-image
						aspectRatio="1/0.5"
						src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
						alt="A stylized graphic of four characters, each holding a puzzle piece"
					></s-image>
				</s-box>
				<s-grid justifyItems="center" maxInlineSize="450px" gap="base">
					<s-stack alignItems="center">
						<s-heading>Start creating puzzles</s-heading>
						<s-paragraph>
							Create and manage your collection of puzzles for players to enjoy.
						</s-paragraph>
					</s-stack>
					<s-button-group>
						<s-button slot="secondary-actions" accessibilityLabel="Learn more about creating puzzles">
							Learn more
						</s-button>
						<s-button slot="primary-action" accessibilityLabel="Add a new puzzle">
							Create puzzle
						</s-button>
					</s-button-group>
				</s-grid>
			</s-grid>
		</s-section>
	{/if}
</s-page>
