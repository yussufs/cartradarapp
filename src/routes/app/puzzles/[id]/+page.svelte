<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let puzzle = $state(data.puzzle);
	let searchQuery = $state('');

	interface Template {
		id: string;
		name: string;
		pieces: number;
		image: string;
	}

	// Mock template data
	const allTemplates: Template[] = [
		{ id: '1', name: '16-pieces puzzle', pieces: 16, image: 'https://cdn.shopify.com/static/images/polaris/patterns/16-pieces.png' },
		{ id: '2', name: '9-pieces puzzle', pieces: 9, image: 'https://cdn.shopify.com/static/images/polaris/patterns/9-pieces.png' },
		{ id: '3', name: '25-pieces puzzle', pieces: 25, image: 'https://picsum.photos/id/29/40/40' },
		{ id: '4', name: '36-pieces puzzle', pieces: 36, image: 'https://picsum.photos/id/12/40/40' }
	];

	let filteredTemplates = $derived(
		searchQuery
			? allTemplates.filter((t) =>
					t.name.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: allTemplates
	);

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);
		const formEntries = Object.fromEntries(formData);
		console.log('Form data', formEntries);
		window.shopify?.toast.show('Puzzle saved');
	}

	function handleReset() {
		console.log('Handle discarded changes if necessary');
	}

	function handleSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		searchQuery = input.value;
	}

	function getStatusTone(status: string): string {
		return status === 'active' ? 'success' : 'neutral';
	}

	function formatStatus(status: string): string {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}
</script>

<svelte:head>
	<title>{puzzle.name} - Puzzle Details</title>
</svelte:head>

<form data-save-bar onsubmit={handleSubmit} onreset={handleReset}>
	<s-page heading={puzzle.name} inlineSize="small" breadcrumb="/app/puzzles">
		<s-button slot="primary-action" variant="primary" submit>Save</s-button>
		<s-button slot="secondary-actions" variant="secondary">Duplicate</s-button>
		<s-button slot="secondary-actions" variant="secondary" tone="critical">Delete</s-button>

		<!-- Puzzle Information -->
		<s-section heading="Puzzle information">
			<s-text-field
				label="Name"
				name="name"
				value={puzzle.name}
				placeholder="Enter puzzle name"
			></s-text-field>
			<s-text-field
				label="Description"
				name="description"
				value={puzzle.description}
				placeholder="Enter puzzle description"
				multiline
				rows="3"
			></s-text-field>
			<s-grid gridTemplateColumns="1fr 1fr" gap="base">
				<s-text-field
					label="Price"
					name="price"
					value={puzzle.price}
					prefix="$"
					type="number"
					step="0.01"
				></s-text-field>
				<s-text-field
					label="Stock"
					name="stock"
					value={String(puzzle.stock)}
					type="number"
				></s-text-field>
			</s-grid>
		</s-section>

		<!-- Puzzle Settings -->
		<s-section heading="Puzzle settings">
			<s-select label="Size" name="size">
				<s-option value="small" selected={puzzle.size === 'small'}>Small (8" x 8")</s-option>
				<s-option value="medium" selected={puzzle.size === 'medium'}>Medium (12" x 12")</s-option>
				<s-option value="large" selected={puzzle.size === 'large'}>Large (18" x 18")</s-option>
			</s-select>
			<s-select label="Piece count" name="pieces">
				<s-option value="9" selected={puzzle.pieces === 9}>9 pieces</s-option>
				<s-option value="16" selected={puzzle.pieces === 16}>16 pieces</s-option>
				<s-option value="25" selected={puzzle.pieces === 25}>25 pieces</s-option>
				<s-option value="36" selected={puzzle.pieces === 36}>36 pieces</s-option>
			</s-select>
			<s-select label="Material" name="material">
				<s-option value="cardboard" selected={puzzle.material === 'cardboard'}>Cardboard</s-option>
				<s-option value="wood" selected={puzzle.material === 'wood'}>Wood</s-option>
				<s-option value="premium" selected={puzzle.material === 'premium'}>Premium (Recycled)</s-option>
			</s-select>
		</s-section>

		<!-- Puzzle Templates with Search -->
		<s-section heading="Puzzle templates">
			<s-grid gap="base">
				<s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
					<s-grid-item>
						<s-search-field
							label="Search templates"
							labelAccessibilityVisibility="exclusive"
							placeholder="Search templates"
							value={searchQuery}
							oninput={handleSearch}
						></s-search-field>
					</s-grid-item>
					<s-grid-item>
						<s-button>Browse</s-button>
					</s-grid-item>
				</s-grid>
				<s-box
					background="strong"
					border="base"
					borderRadius="base"
					borderStyle="solid"
					overflow="hidden"
				>
					<s-table>
						<s-table-header-row>
							<s-table-header listSlot="primary">Template</s-table-header>
							<s-table-header>
								<s-stack alignItems="end">Actions</s-stack>
							</s-table-header>
							<s-table-header listSlot="secondary">
								<s-stack direction="inline" alignItems="end"></s-stack>
							</s-table-header>
						</s-table-header-row>
						<s-table-body>
							{#each filteredTemplates as template (template.id)}
								<s-table-row clickDelegate="template-{template.id}-checkbox">
									<s-table-cell>
										<s-stack direction="inline" gap="base" alignItems="center">
											<s-checkbox id="template-{template.id}-checkbox"></s-checkbox>
											<s-box
												border="base"
												borderRadius="base"
												overflow="hidden"
												maxInlineSize="40px"
												maxBlockSize="40px"
											>
												<s-image
													alt="{template.name} template"
													src={template.image}
												></s-image>
											</s-box>
											{template.name}
										</s-stack>
									</s-table-cell>
									<s-table-cell>
										<s-stack alignItems="end">
											<s-link href="/app/templates/{template.id}">Preview</s-link>
										</s-stack>
									</s-table-cell>
									<s-table-cell>
										<s-stack alignItems="end">
											<s-button
												icon="x"
												tone="neutral"
												variant="tertiary"
												accessibilityLabel="Remove {template.name} template"
											></s-button>
										</s-stack>
									</s-table-cell>
								</s-table-row>
							{/each}
						</s-table-body>
					</s-table>
				</s-box>
				{#if filteredTemplates.length === 0}
					<s-box padding="large-400">
						<s-stack alignItems="center" gap="small">
							<s-text color="subdued">No templates found matching "{searchQuery}"</s-text>
						</s-stack>
					</s-box>
				{/if}
			</s-grid>
		</s-section>

		<!-- Advanced Settings with Switch -->
		<s-section heading="Advanced settings">
			<s-box border="base" borderRadius="base" padding="base">
				<s-stack gap="base">
					<s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
						<s-box>
							<s-text fontWeight="semibold">Enable piece rotation</s-text>
							<s-text color="subdued">Allow players to rotate puzzle pieces while solving</s-text>
						</s-box>
						<s-switch name="piece-rotation" checked></s-switch>
					</s-grid>
					<s-divider></s-divider>
					<s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
						<s-box>
							<s-text fontWeight="semibold">Show piece preview</s-text>
							<s-text color="subdued">Display a small preview of the completed puzzle</s-text>
						</s-box>
						<s-switch name="piece-preview" checked></s-switch>
					</s-grid>
					<s-divider></s-divider>
					<s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
						<s-box>
							<s-text fontWeight="semibold">Enable hints</s-text>
							<s-text color="subdued">Allow players to request hints while solving</s-text>
						</s-box>
						<s-switch name="hints-enabled"></s-switch>
					</s-grid>
				</s-stack>
			</s-box>
		</s-section>

		<!-- Publishing -->
		<s-section heading="Publishing">
			<s-choice-list label="Status" name="status">
				<s-choice value="active" selected={puzzle.status === 'active'}>Active</s-choice>
				<s-choice value="draft" selected={puzzle.status === 'draft'}>Draft</s-choice>
			</s-choice-list>
			<s-box paddingBlockStart="base">
				<s-switch label="Featured puzzle" name="featured" checked={puzzle.featured}>
					Display this puzzle prominently on the homepage
				</s-switch>
			</s-box>
		</s-section>

		<!-- Aside slot with puzzle summary -->
		<s-box slot="aside">
			<s-stack gap="base">
				<!-- Puzzle Preview Card -->
				<s-section heading="Preview">
					<s-box border="base" borderRadius="base" overflow="hidden">
						<s-image
							src={puzzle.image}
							alt="{puzzle.name} puzzle preview"
							aspectRatio="1/1"
							objectFit="cover"
						></s-image>
					</s-box>
					<s-box paddingBlockStart="small">
						<s-button variant="secondary" fullWidth>Change image</s-button>
					</s-box>
				</s-section>

				<!-- Puzzle Summary -->
				<s-section heading="Summary">
					<s-box border="base" borderRadius="base" padding="base">
						<s-stack gap="small">
							<s-grid gridTemplateColumns="1fr 1fr" gap="small">
								<s-text color="subdued">Status</s-text>
								<s-badge color="base" tone={getStatusTone(puzzle.status)}>
									{formatStatus(puzzle.status)}
								</s-badge>
							</s-grid>
							<s-divider></s-divider>
							<s-grid gridTemplateColumns="1fr 1fr" gap="small">
								<s-text color="subdued">Price</s-text>
								<s-text fontWeight="semibold">${puzzle.price}</s-text>
							</s-grid>
							<s-divider></s-divider>
							<s-grid gridTemplateColumns="1fr 1fr" gap="small">
								<s-text color="subdued">Pieces</s-text>
								<s-text fontWeight="semibold">{puzzle.pieces}</s-text>
							</s-grid>
							<s-divider></s-divider>
							<s-grid gridTemplateColumns="1fr 1fr" gap="small">
								<s-text color="subdued">Stock</s-text>
								<s-text fontWeight="semibold">{puzzle.stock} units</s-text>
							</s-grid>
							<s-divider></s-divider>
							<s-grid gridTemplateColumns="1fr 1fr" gap="small">
								<s-text color="subdued">Created</s-text>
								<s-text>{puzzle.created}</s-text>
							</s-grid>
						</s-stack>
					</s-box>
				</s-section>
			</s-stack>
		</s-box>
	</s-page>
</form>
