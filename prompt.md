Replace flowbite components and embla carousel with ark ui components in this svelte component:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { AccordionItem, Accordion } from 'flowbite-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
	import Autoplay from 'embla-carousel-autoplay';
	import { architectsStore, projectsStore, tasksStore } from '$lib/stores';
	import { getPriorityColor, getPriorityGradient, getStatusColor } from '$lib/utils/colorUtils';
	import { formatDate } from '$lib/utils/dateUtils';

	let loading = $state(true);
	let error: string | null = $state(null);

	// Subscribe to stores
	let projectsState = $state({ list: [], loading: true, error: null, byId: {} });
	let tasksState = $state({ list: [], loading: true, error: null, byId: {} });
	let architectsState = $state({ list: [], loading: true, error: null, byId: {} });

	$effect(() => {
		const unsubProjects = projectsStore.subscribe((state) => {
			projectsState = state;
		});
		return unsubProjects;
	});

	$effect(() => {
		const unsubTasks = tasksStore.subscribe((state) => {
			tasksState = state;
		});
		return unsubTasks;
	});

	$effect(() => {
		const unsubArchitects = architectsStore.subscribe((state) => {
			architectsState = state;
		});
		return unsubArchitects;
	});

	// Build projects with their tasks
	let projectsWithTasks = $derived.by(() => {
		const projects = projectsState.list;
		const tasks = tasksState.list;

		// Group tasks by project
		const tasksByProject = new SvelteMap<string, typeof tasks>();
		tasks.forEach((task) => {
			const projectId = task.projectId;
			if (!tasksByProject.has(projectId)) {
				tasksByProject.set(projectId, []);
			}
			tasksByProject.get(projectId)!.push(task);
		});

		// Add tasks to each project
		const result = projects.map((project) => ({
			...project,
			tasks: tasksByProject.get(project.projectId) || []
		}));

		return result;
	});

	// Embla instances per project
	const carouselInstances = new SvelteMap<string, EmblaCarouselType>();

	function initCarousel(node: HTMLElement, projectId: string) {
		// if no tasks / single task, we still initialize so nav works consistently
		const embla = EmblaCarousel(
			node,
			{
				loop: true,
				align: 'center',
				skipSnaps: false,
				dragFree: false
			},
			[
				Autoplay({
					delay: 4000,
					stopOnInteraction: false,
					stopOnMouseEnter: true
				})
			]
		);

		carouselInstances.set(projectId, embla);

		return {
			destroy() {
				try {
					embla.destroy();
				} catch {}
				carouselInstances.delete(projectId);
			}
		};
	}

	function navigateCarousel(projectId: string, direction: 'prev' | 'next') {
		const embla: EmblaCarouselType = carouselInstances.get(projectId) as EmblaCarouselType;
		if (!embla) return;
		if (direction === 'prev') embla.scrollPrev();
		else embla.scrollNext();
	}

	onMount(async () => {
		try {
			loading = true;

			await Promise.all([architectsStore.load(), projectsStore.load(), tasksStore.load()]);

			// Enrich tasks with architect and project names
			tasksStore.loadWithNames(architectsState.byId, projectsState.byId);

			// Refresh data when window regains focus
			const handleFocus = async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				// Re-enrich tasks after refresh
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			};
			window.addEventListener('focus', handleFocus);

			// Optional: Auto-refresh every 30 seconds
			const refreshInterval = setInterval(async () => {
				await Promise.all([
					architectsStore.refresh(),
					projectsStore.refresh(),
					tasksStore.refresh()
				]);
				// Re-enrich tasks after auto-refresh
				tasksStore.loadWithNames(architectsState.byId, projectsState.byId);
			}, 30000); // 30 seconds

			// Cleanup
			return () => {
				window.removeEventListener('focus', handleFocus);
				clearInterval(refreshInterval);
				// destroy any remaining embla instances
				for (const id of carouselInstances.keys()) {
					const inst = carouselInstances.get(id);
					try {
						inst.destroy();
					} catch {}
				}
				carouselInstances.clear();
			};
		} catch (err) {
			console.error('Error loading data:', err);
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = 'Unknown error occurred';
			}
		} finally {
			loading = false;
		}
	});
</script>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<div class="h-16 w-16 animate-spin rounded-full border-b-2 border-blue-600"></div>
	</div>
{:else if error}
	<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
		<h2 class="mb-2 font-semibold">Error loading data</h2>
		<p>{error}</p>
	</div>
{:else if projectsWithTasks.length === 0}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
		<p>No projects found.</p>
	</div>
{:else}
	<div class="flex flex-row flex-wrap items-start justify-center gap-2">
		{#each projectsWithTasks as project (project.projectId)}
			{#if project}
				{#if project.tasks.length > 0}
					<Accordion
						class="group inline-block w-full
          					max-w-[350px]
          					grow
          					break-inside-avoid
          					[-webkit-column-break-inside:avoid]
          					[page-break-inside:avoid]"
					>
						<AccordionItem
							classes={{
								inactive:
									'flex h-[50px] rounded-xl flex-row items-center justify-between rounded-t-lg bg-gradient-to-r from-blue-50 to-purple-100 p-2 text-slate-800',
								active:
									'flex flex-row h-[50px] items-center justify-between rounded-t-lg bg-gradient-to-r from-blue-50 to-purple-100 text-slate-800',
								content: 'p-2'
							}}
							open={project.tasks.length > 0}
						>
							{#snippet arrowup()}{/snippet}
							{#snippet arrowdown()}{/snippet}
							{#snippet header()}
								<div class="flex min-w-0 flex-1 items-center gap-2">
									<div
										class="min-h-4 min-w-4 shrink-0 rounded-full {getPriorityColor(
											project.projectPriority
										)}"
									></div>
									<h2 class="truncate text-2xl font-black">
										{project.projectName}
									</h2>
								</div>
								<p class="ml-2 text-center text-2xl font-bold text-nowrap text-slate-800">
									{project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}
								</p>
							{/snippet}

							<!-- Project Content -->
							<div class="flex flex-col">
								<!-- Project Details -->
								<div class="shrink-0">
									<div class="flex min-w-0 flex-col gap-2">
										<div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
											{#if project.projectStatus}
												<span
													class="shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-bold whitespace-nowrap lg:text-lg {getStatusColor(
														project.projectStatus
													)}"
												>
													{project.projectStatus}
												</span>
											{/if}
										</div>

										<div
											class="mb-2 flex items-center justify-between gap-2 text-lg font-medium text-gray-900 lg:text-xl"
										>
											<span>Start: {formatDate(project.projectStartDate)}</span>
											<span>Due: {formatDate(project.projectDueDate)}</span>
										</div>
									</div>

									{#if project.projectDescription}
										<p class="text-md mt-2 text-gray-600 lg:text-lg">
											{project.projectDescription}
										</p>
									{/if}
								</div>

								<!-- Tasks Section: Carousel where each task is a slide -->
								{#if project.tasks.length > 0}
									<div
										class="mt-2 flex flex-1 flex-col overflow-hidden border-t border-gray-200 pt-2"
									>
										<!-- EMBLA: outer wrapper -->
										<div class="relative flex flex-1 flex-col">
											<div
												class="embla overflow-hidden"
												use:initCarousel={project.projectId}
												aria-hidden={project.tasks.length === 0}
											>
												<div class="embla__container flex gap-4">
													{#each project.tasks as task (task.taskId)}
														<!-- each task => a slide -->
														<div
															class="embla__slide
																min-w-full
              									shrink
																overflow-hidden
              									px-2"
														>
															<div
																class="flex h-full min-h-[100px] w-full flex-col justify-between rounded-2xl border border-neutral-600/20 bg-linear-to-br p-4 duration-200 md:p-5 {getPriorityGradient(
																	task.taskPriority
																)}"
															>
																<div class="flex items-center justify-between gap-2">
																	<div class="min-w-0 flex-1">
																		<p
																			class="text-md min-w-0 flex-1 items-center truncate font-bold text-gray-900 md:text-lg"
																		>
																			{task.taskName}
																		</p>
																	</div>

																	<div class="shrink-0">
																		{#if task.taskStatus}
																			<span
																				class="lg:text-md inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium whitespace-nowrap {getStatusColor(
																					task.taskStatus
																				)}"
																			>
																				{task.taskStatus}
																			</span>
																		{/if}
																	</div>
																</div>

																{#if task.taskDescription}
																	<p class="lg:text-md mt-2 line-clamp-3 text-sm text-gray-600">
																		{task.taskDescription}
																	</p>
																{/if}

																<div
																	class="text-md mt-3 flex items-center justify-between gap-2 text-gray-800"
																>
																	<span>Start: {formatDate(task.taskStartDate)}</span>
																	<span>Due: {formatDate(task.taskDueDate)}</span>
																</div>

																<!-- Assigned to (kept) -->
																<div class="mt-3 border-t border-gray-200 pt-2 md:mt-4 md:pt-3">
																	{#if task.architectName}
																		<p class="text-lg text-gray-700">
																			Assigned to:
																			<span class="font-bold text-gray-900"
																				>{task.architectName}</span
																			>
																		</p>
																	{:else}
																		<p class="text-xs text-gray-500 italic md:text-sm">
																			Unassigned
																		</p>
																	{/if}
																</div>
															</div>
														</div>
													{/each}
												</div>
											</div>

											<!-- nav buttons for each project's carousel -->
											{#if project.tasks.length > 1}
												<button
													class="bg-opacity-90 hover:bg-opacity-100 absolute top-1/2 left-2 -translate-y-1/2 transform rounded-full bg-white p-2 text-gray-700 opacity-0 duration-200 group-hover:opacity-100"
													onclick={() => navigateCarousel(project.projectId, 'prev')}
													aria-label="Previous task"
												>
													<svg
														class="h-5 w-5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M15 19l-7-7 7-7"
														/>
													</svg>
												</button>

												<button
													class="bg-opacity-90 hover:bg-opacity-100 absolute top-1/2 right-2 -translate-y-1/2 transform rounded-full bg-white p-2 text-gray-700 opacity-0 duration-200 group-hover:opacity-100"
													onclick={() => navigateCarousel(project.projectId, 'next')}
													aria-label="Next task"
												>
													<svg
														class="h-5 w-5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M9 5l7 7-7 7"
														/>
													</svg>
												</button>
											{/if}
										</div>
									</div>
								{:else}
									<div class="flex flex-1 items-center justify-center p-6">
										<p class="text-center text-gray-500">No tasks assigned to this project</p>
									</div>
								{/if}
							</div>
						</AccordionItem>
					</Accordion>
				{/if}
			{/if}
		{/each}
	</div>
{/if}

<style>
	/* Custom scrollbar for subtasks */
	.overflow-y-auto::-webkit-scrollbar {
		width: 4px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 2px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 2px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb:hover {
		background: #cbd5f9;
	}

	/* clamp helper same as carousel */
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
```

List of links for relevant documentation can be found on this page:
[https://ark-ui.com/llms.txt]

Some relevant component documentation for your reference. Rest you can lookup using the llms.txt yourself.

# Accordion:

<ComponentPreview id="Accordion" />

## Features

- Full keyboard navigation
- Supports horizontal and vertical orientation
- Right-to-Left (RTL) support
- Single or multiple item expansion
- Controlled and uncontrolled modes
- Collapse each accordion item

## Anatomy

To set up the accordion correctly, it's essential to understand its anatomy and the naming of its parts.

> Each part includes a `data-part` attribute to help identify them in the DOM.

<Anatomy id="accordion" />

## Examples

### Default Expanded State

Set the `defaultValue` prop to specify which item should be expanded by default.

**Example: basic**

#### Svelte

```svelte
<script>
	import { Accordion } from '@ark-ui/svelte/accordion';
	import { ChevronDownIcon } from 'lucide-svelte';

	const items = ['React', 'Solid', 'Vue', 'Svelte'];
</script>

<Accordion.Root defaultValue={['React']}>
	{#each items as item (item)}
		<Accordion.Item value={item}>
			<Accordion.ItemTrigger>
				What is {item}?
				<Accordion.ItemIndicator>
					<ChevronDownIcon />
				</Accordion.ItemIndicator>
			</Accordion.ItemTrigger>
			<Accordion.ItemContent>
				{item} is a JavaScript library for building user interfaces.
			</Accordion.ItemContent>
		</Accordion.Item>
	{/each}
</Accordion.Root>
```

### Collapsible

Use the `collapsible` prop to allow the user to collapse all panels.

**Example: collapsible**

#### Svelte

```svelte
<script>
	import { Accordion } from '@ark-ui/svelte/accordion';
	import { ChevronDownIcon } from 'lucide-svelte';
</script>

<Accordion.Root defaultValue={['React']} collapsible>
	{#each ['React', 'Solid', 'Vue', 'Svelte'] as item (item)}
		<Accordion.Item value={item}>
			<Accordion.ItemTrigger>
				What is {item}?
				<Accordion.ItemIndicator>
					<ChevronDownIcon />
				</Accordion.ItemIndicator>
			</Accordion.ItemTrigger>
			<Accordion.ItemContent>
				{item} is a JavaScript library for building user interfaces.
			</Accordion.ItemContent>
		</Accordion.Item>
	{/each}
</Accordion.Root>
```

### Multiple Panels

Use the `multiple` prop to allow multiple panels to be expanded simultaneously.

**Example: multiple**

#### Svelte

```svelte
<script>
	import { Accordion } from '@ark-ui/svelte/accordion';
	import { ChevronDownIcon } from 'lucide-svelte';
</script>

<Accordion.Root defaultValue={['React']} multiple>
	{#each ['React', 'Solid', 'Vue', 'Svelte'] as item (item)}
		<Accordion.Item value={item}>
			<Accordion.ItemTrigger>
				What is {item}?
				<Accordion.ItemIndicator>
					<ChevronDownIcon />
				</Accordion.ItemIndicator>
			</Accordion.ItemTrigger>
			<Accordion.ItemContent>
				{item} is a JavaScript library for building user interfaces.
			</Accordion.ItemContent>
		</Accordion.Item>
	{/each}
</Accordion.Root>
```

### Horizontal Orientation

By default, the Accordion is oriented vertically. Use the `orientation` prop to switch to a horizontal layout.

**Example: horizontal**

#### Svelte

```svelte
<script>
	import { Accordion } from '@ark-ui/svelte/accordion';
	import { ChevronRightIcon } from 'lucide-svelte';
</script>

<div style="display: flex; max-width: 900px;">
	<Accordion.Root defaultValue={['React']} orientation="horizontal">
		{#each ['React', 'Solid', 'Vue', 'Svelte'] as item (item)}
			<Accordion.Item value={item} style="display: flex; flex-direction: column;">
				<Accordion.ItemTrigger style="min-height: 2rem; writing-mode: vertical-lr;">
					What is {item}?
					<Accordion.ItemIndicator>
						<ChevronRightIcon />
					</Accordion.ItemIndicator>
				</Accordion.ItemTrigger>
				<Accordion.ItemContent style="max-width: 200px;">
					{item} is a JavaScript library for building user interfaces.
				</Accordion.ItemContent>
			</Accordion.Item>
		{/each}
	</Accordion.Root>
</div>
```

### Using the Root Provider

The `RootProvider` component provides a context for the accordion. It accepts the value of the `useAccordion` hook. You
can leverage it to access the component state and methods from outside the accordion.

**Example: root-provider**

#### Svelte

```svelte
<script>
	import { Accordion, useAccordion } from '@ark-ui/svelte/accordion';
	import { ChevronDownIcon } from 'lucide-svelte';

	const id = $props.id();
	const accordion = useAccordion({
		id,
		defaultValue: ['React']
	});
</script>

<div>
	<div>Open items: {JSON.stringify(accordion().value)}</div>
	<Accordion.RootProvider value={accordion}>
		{#each ['React', 'Solid', 'Vue', 'Svelte'] as item (item)}
			<Accordion.Item value={item}>
				<Accordion.ItemTrigger>
					What is {item}?
					<Accordion.ItemIndicator>
						<ChevronDownIcon />
					</Accordion.ItemIndicator>
				</Accordion.ItemTrigger>
				<Accordion.ItemContent>
					{item} is a JavaScript library for building user interfaces.
				</Accordion.ItemContent>
			</Accordion.Item>
		{/each}
	</Accordion.RootProvider>
</div>
```

> If you're using the `RootProvider` component, you don't need to use the `Root` component.

### Accessing context

Use the `Accordion.Context` component or `useAccordionContext` hook to access the state of an accordion. It exposes the
following properties:

- `focusedValue`: The value of the focused accordion item.
- `value`: The value of the selected accordion items.
- `setValue`: A method to set the selected accordion items.

**Example: context**

#### Svelte

```svelte
<script lang="ts">
	import { Accordion } from '@ark-ui/svelte/accordion';
	import { ChevronDownIcon } from 'lucide-svelte';
</script>

<Accordion.Root defaultValue={['React']}>
	<Accordion.Context>
		{#snippet render(context)}
			<div>
				<span>Selected items: {context().value.join(', ')}</span>
				<span>Focused item: {context().focusedValue}</span>
				<button onclick={() => context().setValue(['React', 'Solid'])}>Set value</button>
			</div>
		{/snippet}
	</Accordion.Context>

	{#each ['React', 'Solid', 'Vue', 'Svelte'] as item}
		<Accordion.Item value={item}>
			<Accordion.ItemTrigger>
				What is {item}?
				<Accordion.ItemIndicator>
					<ChevronDownIcon />
				</Accordion.ItemIndicator>
			</Accordion.ItemTrigger>
			<Accordion.ItemContent
				>{item} is a JavaScript library for building user interfaces.</Accordion.ItemContent
			>
		</Accordion.Item>
	{/each}
</Accordion.Root>
```

### Accessing the item context

Use the `Accordion.ItemContext` component or `useAccordionItemContext` hook to access the state of an accordion item. It
exposes the following properties:

- `expanded`: Whether the accordion item is expanded.
- `focused`: Whether the accordion item is focused.
- `disabled`: Whether the accordion item is disabled.

**Example: item-context**

#### Svelte

```svelte
<script lang="ts">
	import { Accordion } from '@ark-ui/svelte/accordion';
	import { ChevronDownIcon } from 'lucide-svelte';
</script>

<Accordion.Root defaultValue={['React']}>
	{#each ['React', 'Solid', 'Vue', 'Svelte'] as item}
		<Accordion.Item value={item}>
			<Accordion.ItemTrigger>
				What is {item}?
				<Accordion.ItemIndicator>
					<ChevronDownIcon />
				</Accordion.ItemIndicator>
				<Accordion.ItemContext>
					{#snippet render(context)}
						<div style="display: inline-flex; gap: 0.5rem;">
							<span>Expanded: {context().expanded}</span>
							<span>Focused: {context().focused}</span>
							<span>Disabled: {context().disabled}</span>
						</div>
					{/snippet}
				</Accordion.ItemContext>
			</Accordion.ItemTrigger>
			<Accordion.ItemContent
				>{item} is a JavaScript library for building user interfaces.</Accordion.ItemContent
			>
		</Accordion.Item>
	{/each}
</Accordion.Root>
```

## Guides

### Animate Content Size

Use the `--height` and/or `--width` CSS variables to animate the size of the content when it expands or closes:

```css
@keyframes slideDown {
	from {
		opacity: 0.01;
		height: 0;
	}
	to {
		opacity: 1;
		height: var(--height);
	}
}

@keyframes slideUp {
	from {
		opacity: 1;
		height: var(--height);
	}
	to {
		opacity: 0.01;
		height: 0;
	}
}

[data-scope='accordion'][data-part='item-content'][data-state='open'] {
	animation: slideDown 250ms ease-in-out;
}

[data-scope='accordion'][data-part='item-content'][data-state='closed'] {
	animation: slideUp 200ms ease-in-out;
}
```

## API Reference

### Props

**Component API Reference**

#### Svelte

**Root Props:**

| Prop                                                           | Type                        | Required | Description                                                                                         |
| -------------------------------------------------------------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild`                                                      | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `collapsible`                                                  | `boolean`                   | No       | Whether an accordion item can be closed after it has been expanded.                                 |
| `defaultValue`                                                 | `string[]`                  | No       | The initial value of the expanded accordion items.                                                  |
| Use when you don't need to control the value of the accordion. |
| `disabled`                                                     | `boolean`                   | No       | Whether the accordion items are disabled                                                            |
| `id`                                                           | `string`                    | No       | The unique identifier of the machine.                                                               |
| `ids`                                                          | `Partial<{                  |

root: string
item: (value: string) => string
itemContent: (value: string) => string
itemTrigger: (value: string) => string
}>`| No | The ids of the elements in the accordion. Useful for composition. |
|`lazyMount`|`boolean`| No | Whether to enable lazy mounting |
|`multiple`|`boolean`| No | Whether multiple accordion items can be expanded at the same time. |
|`onFocusChange`|`(details: FocusChangeDetails) => void`| No | The callback fired when the focused accordion item changes. |
|`onValueChange`|`(details: ValueChangeDetails) => void`| No | The callback fired when the state of expanded/collapsed accordion items changes. |
|`orientation`|`'horizontal' | 'vertical'`| No | The orientation of the accordion items. |
|`ref`|`Element`| No |  |
|`unmountOnExit`|`boolean`| No | Whether to unmount on exit. |
|`value`|`string[]` | No | The controlled value of the expanded accordion items. |

**Root Data Attributes:**

| Attribute            | Value                            |
| -------------------- | -------------------------------- |
| `[data-scope]`       | accordion                        |
| `[data-part]`        | root                             |
| `[data-orientation]` | The orientation of the accordion |

**Context Props:**

| Prop     | Type                             | Required | Description |
| -------- | -------------------------------- | -------- | ----------- |
| `render` | `Snippet<[UseAccordionContext]>` | Yes      |             |

**ItemContent Props:**

| Prop      | Type                        | Required | Description                                                                                         |
| --------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                   | No       |                                                                                                     |

**ItemContent Data Attributes:**

| Attribute            | Value                       |
| -------------------- | --------------------------- | -------- |
| `[data-scope]`       | accordion                   |
| `[data-part]`        | item-content                |
| `[data-state]`       | "open"                      | "closed" |
| `[data-disabled]`    | Present when disabled       |
| `[data-focus]`       | Present when focused        |
| `[data-orientation]` | The orientation of the item |

**ItemContext Props:**

| Prop     | Type                                 | Required | Description |
| -------- | ------------------------------------ | -------- | ----------- |
| `render` | `Snippet<[UseAccordionItemContext]>` | Yes      |             |

**ItemIndicator Props:**

| Prop      | Type                        | Required | Description                                                                                         |
| --------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                   | No       |                                                                                                     |

**ItemIndicator Data Attributes:**

| Attribute            | Value                       |
| -------------------- | --------------------------- | -------- |
| `[data-scope]`       | accordion                   |
| `[data-part]`        | item-indicator              |
| `[data-state]`       | "open"                      | "closed" |
| `[data-disabled]`    | Present when disabled       |
| `[data-focus]`       | Present when focused        |
| `[data-orientation]` | The orientation of the item |

**Item Props:**

| Prop       | Type                        | Required | Description                                                                                         |
| ---------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `value`    | `string`                    | Yes      | The value of the accordion item.                                                                    |
| `asChild`  | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `disabled` | `boolean`                   | No       | Whether the accordion item is disabled.                                                             |
| `ref`      | `Element`                   | No       |                                                                                                     |

**Item Data Attributes:**

| Attribute            | Value                       |
| -------------------- | --------------------------- | -------- |
| `[data-scope]`       | accordion                   |
| `[data-part]`        | item                        |
| `[data-state]`       | "open"                      | "closed" |
| `[data-focus]`       | Present when focused        |
| `[data-disabled]`    | Present when disabled       |
| `[data-orientation]` | The orientation of the item |

**ItemTrigger Props:**

| Prop      | Type                           | Required | Description                                                                                         |
| --------- | ------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'button'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                      | No       |                                                                                                     |

**ItemTrigger Data Attributes:**

| Attribute            | Value                       |
| -------------------- | --------------------------- | -------- |
| `[data-scope]`       | accordion                   |
| `[data-part]`        | item-trigger                |
| `[data-orientation]` | The orientation of the item |
| `[data-state]`       | "open"                      | "closed" |

**RootProvider Props:**

| Prop            | Type                        | Required | Description                                                                                         |
| --------------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `value`         | `UseAccordionReturn`        | Yes      |                                                                                                     |
| `asChild`       | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `lazyMount`     | `boolean`                   | No       | Whether to enable lazy mounting                                                                     |
| `ref`           | `Element`                   | No       |                                                                                                     |
| `unmountOnExit` | `boolean`                   | No       | Whether to unmount on exit.                                                                         |

### Context

These are the properties available when using `Accordion.Context`, `useAccordionContext` hook or `useAccordion` hook.

**API:**

| Property       | Type                              | Description                              |
| -------------- | --------------------------------- | ---------------------------------------- |
| `focusedValue` | `string`                          | The value of the focused accordion item. |
| `value`        | `string[]`                        | The value of the accordion               |
| `setValue`     | `(value: string[]) => void`       | Sets the value of the accordion          |
| `getItemState` | `(props: ItemProps) => ItemState` | Returns the state of an accordion item.  |

## Accessibility

This component complies with the
[Accordion WAI-ARIA design pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/).

### Keyboard Support

<KeyBindingsTable id="accordion" />

===================================================

# Carousel:

<ComponentPreview id="Carousel" />

## Features

- Native CSS Scroll Snap integration for smooth, performant animations
- Flexible orientation support (horizontal and vertical layouts)
- Customizable slide alignment (start, center, or end positions)
- Multi-slide display capabilities for complex layouts
- Automatic playback with configurable looping behavior
- Adjustable slide spacing and gap controls

## Anatomy

To set up the carousel correctly, you'll need to understand its anatomy and how we name its parts.

> Each part includes a `data-part` attribute to help identify them in the DOM.

<Anatomy id="carousel" />

## Examples

Learn how to use the `Carousel` component in your project. Let's take a look at the most basic example:

**Example: basic**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';

	const images = Array.from({ length: 5 }, (_, i) => `https://picsum.photos/seed/${i + 1}/500/300`);
</script>

<Carousel.Root defaultPage={0} slideCount={images.length}>
	<Carousel.Control>
		<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
		<Carousel.NextTrigger>Next</Carousel.NextTrigger>
	</Carousel.Control>
	<Carousel.IndicatorGroup>
		{#each images as _, index}
			<Carousel.Indicator {index} />
		{/each}
	</Carousel.IndicatorGroup>
	<Carousel.ItemGroup>
		{#each images as image, index}
			<Carousel.Item {index}>
				<img src={image} alt="Slide {index}" />
			</Carousel.Item>
		{/each}
	</Carousel.ItemGroup>
</Carousel.Root>
```

### Controlled

To create a controlled Carousel component, you can manage the state of the carousel using the `page` prop and update it
when the `onPageChange` event handler is called:

**Example: controlled**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';

	const images = Array.from({ length: 5 }, (_, i) => `https://picsum.photos/seed/${i + 1}/500/300`);
	let page = $state(0);
</script>

<div>
	<div>Current page: {page}</div>
	<Carousel.Root bind:page slideCount={images.length}>
		<Carousel.Control>
			<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
			<Carousel.NextTrigger>Next</Carousel.NextTrigger>
		</Carousel.Control>
		<Carousel.IndicatorGroup>
			{#each images as _, index}
				<Carousel.Indicator {index} />
			{/each}
		</Carousel.IndicatorGroup>
		<Carousel.ItemGroup>
			{#each images as image, index}
				<Carousel.Item {index}>
					<img src={image} alt="Slide {index}" />
				</Carousel.Item>
			{/each}
		</Carousel.ItemGroup>
	</Carousel.Root>
</div>
```

### Root Provider

Use the `useCarousel` hook to create the carousel store and pass it to the `Carousel.RootProvider` component. This
allows you to have maximum control over the carousel programmatically.

**Example: root-provider**

#### Svelte

```svelte
<script>
	import { Carousel, useCarousel } from '@ark-ui/svelte/carousel';

	const images = Array.from({ length: 5 }, (_, i) => `https://picsum.photos/seed/${i + 1}/500/300`);

	const id = $props.id();
	const carousel = useCarousel({
		id,
		defaultPage: 0,
		slideCount: images.length
	});
</script>

<div>
	<div>Current page: {carousel().page}</div>
	<Carousel.RootProvider value={carousel}>
		<Carousel.Control>
			<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
			<Carousel.NextTrigger>Next</Carousel.NextTrigger>
		</Carousel.Control>
		<Carousel.IndicatorGroup>
			{#each images as _, index}
				<Carousel.Indicator {index} />
			{/each}
		</Carousel.IndicatorGroup>
		<Carousel.ItemGroup>
			{#each images as image, index}
				<Carousel.Item {index}>
					<img src={image} alt="Slide {index}" />
				</Carousel.Item>
			{/each}
		</Carousel.ItemGroup>
	</Carousel.RootProvider>
</div>
```

> If you're using the `Carousel.RootProvider` component, you don't need to use the `Carousel.Root` component.

### Autoplay

Pass the `autoplay` and `loop` props to `Carousel.Root` to make the carousel play automatically.

> **Note:** Adding `loop` ensures the carousel keeps going after the last slide.

**Example: autoplay**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';

	const images = Array.from({ length: 5 }, (_, i) => `https://picsum.photos/seed/${i + 1}/500/300`);
</script>

<Carousel.Root defaultPage={0} slideCount={images.length} autoplay={{ delay: 3000 }}>
	<Carousel.Control>
		<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
		<Carousel.AutoplayTrigger>
			<Carousel.AutoplayIndicator>
				{#snippet fallback()}Play{/snippet}
				Pause
			</Carousel.AutoplayIndicator>
		</Carousel.AutoplayTrigger>
		<Carousel.NextTrigger>Next</Carousel.NextTrigger>
		<Carousel.ProgressText />
	</Carousel.Control>
	<Carousel.IndicatorGroup>
		{#each images as _, index}
			<Carousel.Indicator {index} />
		{/each}
	</Carousel.IndicatorGroup>
	<Carousel.ItemGroup>
		{#each images as image, index}
			<Carousel.Item {index}>
				<img src={image} alt="Slide {index}" />
			</Carousel.Item>
		{/each}
	</Carousel.ItemGroup>
</Carousel.Root>
```

### Pause on Hover

This feature isn't built-in, but you can use the `play()` and `pause()` methods from `Carousel.Context` to implement
pause on hover.

Add the `autoplay` and `loop` props to `Carousel.Root`, then attach `onPointerOver` and `onPointerLeave` handlers to
`Carousel.ItemGroup` that call `api.pause()` and `api.play()` respectively.

**Example: pause-on-hover**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';

	const images = Array.from({ length: 5 }, (_, i) => `https://picsum.photos/seed/${i + 1}/500/300`);
</script>

<Carousel.Root slideCount={images.length} autoplay loop>
	<Carousel.Control>
		<Carousel.Context>
			{#snippet render(api)}
				Autoplay is: {api().isPlaying ? 'playing' : 'paused'}
			{/snippet}
		</Carousel.Context>
	</Carousel.Control>
	<Carousel.Context>
		{#snippet render(api)}
			<Carousel.ItemGroup onpointerover={() => api().pause()} onpointerleave={() => api().play()}>
				{#each images as image, index}
					<Carousel.Item {index}>
						<img src={image} alt="Slide {index}" />
					</Carousel.Item>
				{/each}
			</Carousel.ItemGroup>
		{/snippet}
	</Carousel.Context>
	<Carousel.IndicatorGroup>
		{#each images as _, index}
			<Carousel.Indicator {index} />
		{/each}
	</Carousel.IndicatorGroup>
</Carousel.Root>
```

### Custom Indicators

Replace default indicator dots with custom content by wrapping `Carousel.IndicatorGroup` in `Carousel.Context`. Use
`api.page` to determine the active indicator and render image thumbnails for each slide:

**Example: custom-indicator**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';

	const images = Array.from({ length: 5 }, (_, i) => `https://picsum.photos/seed/${i + 1}/500/300`);
</script>

<Carousel.Root defaultPage={0} slideCount={images.length}>
	<Carousel.Control>
		<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
		<Carousel.NextTrigger>Next</Carousel.NextTrigger>
	</Carousel.Control>
	<Carousel.ItemGroup>
		{#each images as image, index}
			<Carousel.Item {index}>
				<img
					src={image}
					alt="Slide {index}"
					style="width: 100%; height: 300px; object-fit: cover;"
				/>
			</Carousel.Item>
		{/each}
	</Carousel.ItemGroup>
	<Carousel.Context>
		{#snippet render(api)}
			<Carousel.IndicatorGroup style="display: flex; gap: 8px; margin-top: 16px;">
				{#each images as image, index}
					<Carousel.Indicator {index}>
						<img
							src={image}
							alt="Thumbnail {index}"
							style="
                width: 60px;
                height: 40px;
                object-fit: cover;
                cursor: pointer;
                border: {api().page === index ? '2px solid #0066ff' : '2px solid transparent'};
                border-radius: 4px;
                opacity: {api().page === index ? 1 : 0.6};
                transition: all 0.2s;
              "
						/>
					</Carousel.Indicator>
				{/each}
			</Carousel.IndicatorGroup>
		{/snippet}
	</Carousel.Context>
</Carousel.Root>
```

### Vertical Orientation

Set the `orientation="vertical"` prop on `Carousel.Root` to change the carousel from horizontal to vertical scrolling.
This is useful for vertical galleries or content feeds.

**Example: vertical**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';

	const images = Array.from({ length: 5 }, (_, i) => `https://picsum.photos/seed/${i + 1}/500/300`);
</script>

<Carousel.Root defaultPage={0} orientation="vertical" slideCount={images.length}>
	<Carousel.Control>
		<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
		<Carousel.NextTrigger>Next</Carousel.NextTrigger>
	</Carousel.Control>
	<Carousel.IndicatorGroup>
		{#each images as _, index}
			<Carousel.Indicator {index} />
		{/each}
	</Carousel.IndicatorGroup>
	<Carousel.ItemGroup>
		{#each images as image, index}
			<Carousel.Item {index}>
				<img src={image} alt="Slide {index}" />
			</Carousel.Item>
		{/each}
	</Carousel.ItemGroup>
</Carousel.Root>
```

### Dynamic Slides

Manage slides dynamically by storing them in state and syncing the carousel page. Pass the `page` prop and
`onPageChange` handler to `Carousel.Root`, and update `slideCount` when slides are added or removed. This demonstrates
bidirectional state synchronization between your component state and the carousel.

**Example: dynamic-slides**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';

	let slides = $state([0, 1, 2, 3, 4]);
	let page = $state(0);

	function addSlide() {
		const max = Math.max(...slides);
		slides = [...slides, max + 1];
	}
</script>

<div>
	<Carousel.Root bind:page slideCount={slides.length}>
		<Carousel.Control>
			<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
			<Carousel.NextTrigger>Next</Carousel.NextTrigger>
		</Carousel.Control>
		<Carousel.IndicatorGroup>
			{#each slides as _, index}
				<Carousel.Indicator {index} />
			{/each}
		</Carousel.IndicatorGroup>
		<Carousel.ItemGroup>
			{#each slides as slide, index}
				<Carousel.Item {index}>
					<div
						style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 300px;
              background-color: hsl({(slide * 60) % 360}, 70%, 60%);
              color: white;
              font-size: 24px;
              font-weight: bold;
              border-radius: 8px;
            "
					>
						Slide {slide}
					</div>
				</Carousel.Item>
			{/each}
		</Carousel.ItemGroup>
	</Carousel.Root>
	<button onclick={addSlide} style="margin-top: 16px; padding: 8px 16px; cursor: pointer;"
		>Add Slide</button
	>
</div>
```

### Scroll to Slide

Use `Carousel.Context` to access the carousel API and call `api.scrollToIndex(index)` to programmatically navigate to a
specific slide. This is useful for creating custom navigation or jump-to-slide functionality.

**Example: scroll-to**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';
</script>

<Carousel.Root slideCount={5}>
	<Carousel.Context>
		{#snippet render(carousel)}
			<button onclick={() => carousel().scrollToIndex(3)}>Go to slide 4</button>
		{/snippet}
	</Carousel.Context>
	<Carousel.ItemGroup>
		{#each Array.from({ length: 5 }) as _, index}
			<Carousel.Item {index}>
				<div
					style="display: flex; align-items: center; justify-content: center; width: 100%; height: 300px; background-color: #f0f0f0; font-size: 24px; font-weight: bold; border-radius: 8px;"
				>
					Slide {index + 1}
				</div>
			</Carousel.Item>
		{/each}
	</Carousel.ItemGroup>
	<Carousel.Control>
		<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
		<Carousel.NextTrigger>Next</Carousel.NextTrigger>
	</Carousel.Control>
	<Carousel.IndicatorGroup>
		{#each Array.from({ length: 5 }) as _, index}
			<Carousel.Indicator {index} />
		{/each}
	</Carousel.IndicatorGroup>
</Carousel.Root>
```

### Slides Per Page

Display multiple slides simultaneously by setting the `slidesPerPage` prop on `Carousel.Root`. Use `api.pageSnapPoints`
from `Carousel.Context` to render the correct number of indicators based on pages rather than individual slides. Add the
`spacing` prop to control the gap between slides.

**Example: slides-per-page**

#### Svelte

```svelte
<script>
	import { Carousel } from '@ark-ui/svelte/carousel';

	const slides = Array.from({ length: 5 }, (_, i) => i);
</script>

<Carousel.Root slideCount={slides.length} slidesPerPage={2} spacing="20px">
	<Carousel.Control>
		<Carousel.PrevTrigger>Previous</Carousel.PrevTrigger>
		<Carousel.NextTrigger>Next</Carousel.NextTrigger>
	</Carousel.Control>
	<Carousel.ItemGroup>
		{#each slides as _, index}
			<Carousel.Item {index}>
				<div
					style="width: 100%; height: 300px; display: flex; align-items: center; justify-content: center; background: #f0f0f0;"
				>
					Slide {index + 1}
				</div>
			</Carousel.Item>
		{/each}
	</Carousel.ItemGroup>
	<Carousel.Context>
		{#snippet render(api)}
			<Carousel.IndicatorGroup>
				{#each api().pageSnapPoints as _, index}
					<Carousel.Indicator {index} />
				{/each}
			</Carousel.IndicatorGroup>
		{/snippet}
	</Carousel.Context>
</Carousel.Root>
```

## API Reference

### Props

**Component API Reference**

#### Svelte

**Root Props:**

| Prop                                                         | Type                        | Required           | Description                                                                                         |
| ------------------------------------------------------------ | --------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `slideCount`                                                 | `number`                    | Yes                | The total number of slides.                                                                         |
| Useful for SSR to render the initial ating the snap points.  |
| `allowMouseDrag`                                             | `boolean`                   | No                 | Whether to allow scrolling via dragging with mouse                                                  |
| `asChild`                                                    | `Snippet<[PropsFn<'div'>]>` | No                 | Use the provided child element as the default rendered element, combining their props and behavior. |
| `autoplay`                                                   | `boolean                    | { delay: number }` | No                                                                                                  | Whether to scroll automatically. The default delay is 4000ms. |
| `defaultPage`                                                | `number`                    | No                 | The initial page to scroll to when rendered.                                                        |
| Use when you don't need to control the page of the carousel. |
| `id`                                                         | `string`                    | No                 | The unique identifier of the machine.                                                               |
| `ids`                                                        | `Partial<{                  |

root: string
item: (index: number) => string
itemGroup: string
nextTrigger: string
prevTrigger: string
indicatorGroup: string
indicator: (index: number) => string
}>`| No | The ids of the elements in the carousel. Useful for composition. |
|`inViewThreshold`|`number | number[]`| No | The threshold for determining if an item is in view. |
|`loop`|`boolean`| No | Whether the carousel should loop around. |
|`onAutoplayStatusChange`|`(details: AutoplayStatusDetails) => void`| No | Function called when the autoplay status changes. |
|`onDragStatusChange`|`(details: DragStatusDetails) => void`| No | Function called when the drag status changes. |
|`onPageChange`|`(details: PageChangeDetails) => void`| No | Function called when the page changes. |
|`orientation`|`'horizontal' | 'vertical'`| No | The orientation of the element. |
|`padding`|`string`| No | Defines the extra space added around the scrollable area,
enabling nearby items to remain partially in view. |
|`page`|`number`| No | The controlled page of the carousel. |
|`ref`|`Element`| No |  |
|`slidesPerMove`|`number | 'auto'` | No | The number of slides to scroll at a time.

When set to `auto`, the number of slides to scroll is determined by the
`slidesPerPage` property. |
| `slidesPerPage` | `number` | No | The number of slides to show at a time. |
| `snapType` | `'proximity' | 'mandatory'` | No | The snap type of the item. |
| `spacing` | `string` | No | The amount of space between items. |
| `translations` | `IntlTranslations` | No | The localized messages to use. |

**Root Data Attributes:**

| Attribute            | Value                           |
| -------------------- | ------------------------------- |
| `[data-scope]`       | carousel                        |
| `[data-part]`        | root                            |
| `[data-orientation]` | The orientation of the carousel |

**AutoplayTrigger Props:**

| Prop      | Type                           | Required | Description                                                                                         |
| --------- | ------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'button'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                      | No       |                                                                                                     |

**AutoplayTrigger Data Attributes:**

| Attribute            | Value                                  |
| -------------------- | -------------------------------------- |
| `[data-scope]`       | carousel                               |
| `[data-part]`        | autoplay-trigger                       |
| `[data-orientation]` | The orientation of the autoplaytrigger |
| `[data-pressed]`     | Present when pressed                   |

**Context Props:**

| Prop     | Type                            | Required | Description |
| -------- | ------------------------------- | -------- | ----------- |
| `render` | `Snippet<[UseCarouselContext]>` | Yes      |             |

**Control Props:**

| Prop      | Type                        | Required | Description                                                                                         |
| --------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                   | No       |                                                                                                     |

**Control Data Attributes:**

| Attribute            | Value                          |
| -------------------- | ------------------------------ |
| `[data-scope]`       | carousel                       |
| `[data-part]`        | control                        |
| `[data-orientation]` | The orientation of the control |

**IndicatorGroup Props:**

| Prop      | Type                        | Required | Description                                                                                         |
| --------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                   | No       |                                                                                                     |

**IndicatorGroup Data Attributes:**

| Attribute            | Value                                 |
| -------------------- | ------------------------------------- |
| `[data-scope]`       | carousel                              |
| `[data-part]`        | indicator-group                       |
| `[data-orientation]` | The orientation of the indicatorgroup |

**Indicator Props:**

| Prop       | Type                           | Required | Description                                                                                         |
| ---------- | ------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `index`    | `number`                       | Yes      | The index of the indicator.                                                                         |
| `asChild`  | `Snippet<[PropsFn<'button'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `readOnly` | `boolean`                      | No       | Whether the indicator is read only.                                                                 |
| `ref`      | `Element`                      | No       |                                                                                                     |

**Indicator Data Attributes:**

| Attribute            | Value                            |
| -------------------- | -------------------------------- |
| `[data-scope]`       | carousel                         |
| `[data-part]`        | indicator                        |
| `[data-orientation]` | The orientation of the indicator |
| `[data-index]`       | The index of the item            |
| `[data-readonly]`    | Present when read-only           |
| `[data-current]`     | Present when current             |

**ItemGroup Props:**

| Prop      | Type                        | Required | Description                                                                                         |
| --------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                   | No       |                                                                                                     |

**ItemGroup Data Attributes:**

| Attribute            | Value                              |
| -------------------- | ---------------------------------- |
| `[data-scope]`       | carousel                           |
| `[data-part]`        | item-group                         |
| `[data-orientation]` | The orientation of the item        |
| `[data-dragging]`    | Present when in the dragging state |

**Item Props:**

| Prop        | Type                        | Required | Description                                                                                         |
| ----------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- | --- | ------------------------------- |
| `index`     | `number`                    | Yes      | The index of the item.                                                                              |
| `asChild`   | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`       | `Element`                   | No       |                                                                                                     |
| `snapAlign` | `'start'                    | 'end'    | 'center'`                                                                                           | No  | The snap alignment of the item. |

**Item Data Attributes:**

| Attribute            | Value                       |
| -------------------- | --------------------------- |
| `[data-scope]`       | carousel                    |
| `[data-part]`        | item                        |
| `[data-index]`       | The index of the item       |
| `[data-inview]`      | Present when in viewport    |
| `[data-orientation]` | The orientation of the item |

**NextTrigger Props:**

| Prop      | Type                           | Required | Description                                                                                         |
| --------- | ------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'button'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                      | No       |                                                                                                     |

**NextTrigger Data Attributes:**

| Attribute            | Value                              |
| -------------------- | ---------------------------------- |
| `[data-scope]`       | carousel                           |
| `[data-part]`        | next-trigger                       |
| `[data-orientation]` | The orientation of the nexttrigger |

**PrevTrigger Props:**

| Prop      | Type                           | Required | Description                                                                                         |
| --------- | ------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild` | `Snippet<[PropsFn<'button'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                      | No       |                                                                                                     |

**PrevTrigger Data Attributes:**

| Attribute            | Value                              |
| -------------------- | ---------------------------------- |
| `[data-scope]`       | carousel                           |
| `[data-part]`        | prev-trigger                       |
| `[data-orientation]` | The orientation of the prevtrigger |

**RootProvider Props:**

| Prop      | Type                        | Required | Description                                                                                         |
| --------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `value`   | `UseCarouselReturn`         | Yes      |                                                                                                     |
| `asChild` | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `ref`     | `Element`                   | No       |                                                                                                     |

### Context

These are the properties available when using `Carousel.Context`, `useCarouselContext` hook or `useCarousel` hook.

**API:**

| Property           | Type                                         | Description                                                                      |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `page`             | `number`                                     | The current index of the carousel                                                |
| `pageSnapPoints`   | `number[]`                                   | The current snap points of the carousel                                          |
| `isPlaying`        | `boolean`                                    | Whether the carousel is auto playing                                             |
| `isDragging`       | `boolean`                                    | Whether the carousel is being dragged. This only works when `draggable` is true. |
| `canScrollNext`    | `boolean`                                    | Whether the carousel is can scroll to the next view                              |
| `canScrollPrev`    | `boolean`                                    | Whether the carousel is can scroll to the previous view                          |
| `scrollToIndex`    | `(index: number, instant?: boolean) => void` | Function to scroll to a specific item index                                      |
| `scrollTo`         | `(page: number, instant?: boolean) => void`  | Function to scroll to a specific page                                            |
| `scrollNext`       | `(instant?: boolean) => void`                | Function to scroll to the next page                                              |
| `scrollPrev`       | `(instant?: boolean) => void`                | Function to scroll to the previous page                                          |
| `getProgress`      | `() => number`                               | Returns the current scroll progress as a percentage                              |
| `play`             | `VoidFunction`                               | Function to start/resume autoplay                                                |
| `pause`            | `VoidFunction`                               | Function to pause autoplay                                                       |
| `isInView`         | `(index: number) => boolean`                 | Whether the item is in view                                                      |
| `refresh`          | `VoidFunction`                               | Function to re-compute the snap points                                           |
| and clamp the page |

## Accessibility

Complies with the [Carousel WAI-ARIA design pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).

===================================================

# Presence:

## Examples

By default the child component starts out as hidden and remains hidden after the `present` state is toggled off. This is
useful for situations where the element needs to be hidden initially and continue to stay hidden after its presence is
no longer required.

**Example: basic**

#### Svelte

```svelte
<script lang="ts">
	import { Presence, type PresenceProps } from '@ark-ui/svelte/presence';

	const props: PresenceProps = $props();
	let present = $state(false);

	function toggle() {
		present = !present;
	}
</script>

<button onclick={toggle}>Toggle</button>

<Presence {...props} {present}>Content</Presence>
```

### Lazy Mount

To delay the mounting of a child component until the `present` prop is set to true, use the `lazyMount` prop:

**Example: lazy-mount**

#### Svelte

```svelte
<script lang="ts">
	import { Presence, type PresenceProps } from '@ark-ui/svelte/presence';

	const props: PresenceProps = $props();
	let present = $state(false);

	function toggle() {
		present = !present;
	}
</script>

<button onclick={toggle}>Toggle</button>

<Presence {...props} lazyMount {present}>Content</Presence>
```

### Unmount on Exit

To remove the child component from the DOM when it's not present, use the `unmountOnExit` prop:

**Example: unmount-on-exit**

#### Svelte

```svelte
<script lang="ts">
	import { Presence, type PresenceProps } from '@ark-ui/svelte/presence';

	const props: PresenceProps = $props();
	let present = $state(false);

	function toggle() {
		present = !present;
	}
</script>

<button onclick={toggle}>Toggle</button>

<Presence {...props} unmountOnExit {present}>Content</Presence>
```

### Combining Lazy Mount and Unmount on Exit

Both `lazyMount` and `unmountOnExit` can be combined for a component to be mounted only when it's present and to be
unmounted when it's no longer present:

**Example: lazy-mount-and-unmount-on-exit**

#### Svelte

```svelte
<script lang="ts">
	import { Presence, type PresenceProps } from '@ark-ui/svelte/presence';

	const props: PresenceProps = $props();
	let present = $state(false);

	function toggle() {
		present = !present;
	}
</script>

<button onclick={toggle}>Toggle</button>

<Presence {...props} lazyMount unmountOnExit {present}>Content</Presence>
```

## API Reference

**Component API Reference**

#### Svelte

**Presence Props:**

| Prop                   | Type                        | Required | Description                                                                                         |
| ---------------------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `asChild`              | `Snippet<[PropsFn<'div'>]>` | No       | Use the provided child element as the default rendered element, combining their props and behavior. |
| `immediate`            | `boolean`                   | No       | Whether to synchronize the present change immediately or defer it to the next frame                 |
| `lazyMount`            | `boolean`                   | No       | Whether to enable lazy mounting                                                                     |
| `onExitComplete`       | `VoidFunction`              | No       | Function called when the animation ends in the closed state                                         |
| `present`              | `boolean`                   | No       | Whether the node is present (controlled by the user)                                                |
| `ref`                  | `Element`                   | No       |                                                                                                     |
| `skipAnimationOnMount` | `boolean`                   | No       | Whether to allow the initial presence animation.                                                    |
| `unmountOnExit`        | `boolean`                   | No       | Whether to unmount on exit.                                                                         |

===================================================

# Styling:

## Overview

Ark UI is a headless component library that works with any styling solution. It provides functional styles for elements
like popovers for positioning, while leaving presentation styles up to you. Some components also expose CSS variables
that can be used for styling or animations.

> **Tip:** Looking for a ready-to-use solution? Checkout [Park UI](https://park-ui.com) for a collection of pre-designed
> styles based on Ark UI components.

### Data Attributes

Ark UI components use `data-scope` and `data-part` attributes to target specific elements within a component.
Interactive components often include `data-*` attributes to indicate their state. For example, here's what an open
accordion item looks like:

```html
<div data-scope="accordion" data-part="item" data-state="open"></div>
```

For more details on each component's data attributes, refer to their respective documentation.

## Styling with CSS

When styling components with CSS, you can target the data attributes assigned to each component part for easy
customization.

### Styling a Part

To style a specific component part, target its `data-scope` and `data-part` attributes:

```css
[data-scope='accordion'][data-part='item'] {
	border-bottom: 1px solid #e5e5e5;
}
```

### Styling a State

To style a component based on its state, use the `data-state` attribute:

```css
[data-scope='accordion'][data-part='item'][data-state='open'] {
	background-color: #f5f5f5;
}
```

> **Tip:** If you prefer using classes instead of data attributes, utilize the `class` or `className` prop to add custom
> classes to Ark UI components.

### Class Names

If you prefer using classes instead of data attributes, utilize `class` or `className` prop to add custom classes to Ark
UI components.

Pass a class:

```jsx
<Accordion.Root>
	<Accordion.Item className="AccordionItem">{/* … */}</Accordion.Item>
</Accordion.Root>
```

Then use in styles:

```css
.AccordionItem {
	border-bottom: 1px solid #e5e5e5;

	&[data-state='open'] {
		background-color: #f5f5f5;
	}
}
```

## Styling with Panda CSS

[Panda CSS](https://panda-css.com) is a best-in-class CSS-in-JS framework that integrates seamlessly with Ark UI,
providing an efficient styling solution.

### Styling a part

Panda offers various ways to write styles, but in the context of Ark UI, we recommend using the `defineSlotRecipe`
function to style a component with its different parts and variants.

> **Important:** When importing anatomy objects, we recommend using the `@ark-ui/<framework>/anatomy` entrypoint (e.g.,
> `@ark-ui/react/anatomy`) instead of the main package export to avoid potential build and import errors.

```ts
import { accordionAnatomy } from '@ark-ui/react/anatomy';
import { defineSlotRecipe } from '@pandacss/dev';

export const accordionStyles = defineSlotRecipe({
	className: 'accordion',
	slots: accordionAnatomy.keys(),
	base: {
		item: {
			borderBottom: '1px solid #e5e5e5'
		}
	},
	defaultVariants: {},
	variants: {}
});
```

### Styling a state

To style a component based on its state, you can use built in
[conditions](https://panda-css.com/docs/customization/conditions) in Panda CSS.

```ts
import { accordionAnatomy } from '@ark-ui/react/anatomy';
import { defineSlotRecipe } from '@pandacss/dev';

export const accordionStyles = defineSlotRecipe({
	className: 'accordion',
	slots: accordionAnatomy.keys(),
	base: {
		item: {
			borderBottom: '1px solid {colors.gray.300}',
			_open: {
				// [!code highlight]
				backgroundColor: 'gray.100'
			}
		}
	},
	defaultVariants: {},
	variants: {}
});
```

## Styling with Tailwind CSS

[Tailwind CSS](https://tailwindcss.com/) is a utility-first CSS framework providing a flexible way to style your
components.

### Styling a Part

To style a part, apply classes directly to the parts using either `class` or `className`, depending on the JavaScript
framework.

```jsx
<Accordion.Root>
	<Accordion.Item className="border-b border-gray-300">{/* … */}</Accordion.Item>
</Accordion.Root>
```

### Styling a State

Leverage Tailwind CSS's variant selector to style a component based on its data-state attribute.

```jsx
<Accordion.Root>
	<Accordion.Item className="border-b border-gray-300 data-[state=open]:bg-gray-100">
		{/* … */}
	</Accordion.Item>
</Accordion.Root>
```

===================================================

# Refs:

## Svelte

In Svelte 5, use the `bind:ref` directive to access the rendered element.

```svelte
<script lang="ts">
  import { Slider } from '@ark-ui/svelte/slider'

  let rootRef = $state<HTMLDivElement | null>(null)
</script>

<Slider.Root bind:ref={rootRef}>{/* ... */}</Slider.Root>
```

===================================================

# Composition:

## The asChild Prop

In Ark UI, the `asChild` prop lets you integrate custom components, ensuring consistent styling and behavior while
promoting flexibility and reusability. All Ark components that render a DOM element accept the `asChild` prop.

Here's an example using `asChild` to integrate a custom `Button` component within a `Popover`:

**Example: as-child**

#### Svelte

```svelte
<script lang="ts">
	import { Popover } from '@ark-ui/svelte/popover';
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet asChild(props)}
			<button {...props()}>Open</button>
		{/snippet}
	</Popover.Trigger>
</Popover.Root>
```

In this example, the `asChild` prop allows the `Button` to be used as the trigger for the `Popover`, inheriting its
behaviors from Popover.Trigger.

## The Ark Factory

You can use the `ark` factory to create your own elements that work just like Ark UI components.

**Example: factory**

#### Svelte

```svelte
<script lang="ts">
	import { Ark } from '@ark-ui/svelte/factory';
</script>

<Ark as="div" id="parent" class="parent" style="background: red;">
	{#snippet asChild(props)}
		<Ark as="span" {...props({ id: 'child', class: 'child', style: 'color: blue' })}>Ark UI</Ark>
	{/snippet}
</Ark>
```

This will produce the following HTML:

```html
<span id="child" class="parent child" style="background: red; color: blue;">Ark UI</span>
```

## ID Composition

When composing components that need to work together, share IDs between them using the `ids` prop for proper
accessibility and interaction.

```tsx
import { Avatar } from '@ark-ui/react/avatar';
import { Tooltip } from '@ark-ui/react/tooltip';
import { useId } from 'react';

export const TooltipWithAvatar = () => {
	const id = useId();

	return (
		<Tooltip.Root ids={{ trigger: id }}>
			<Tooltip.Trigger asChild>
				<Avatar.Root ids={{ root: id }}>
					<Avatar.Image src="https://bit.ly/sage-adebayo" />
					<Avatar.Fallback>SA</Avatar.Fallback>
				</Avatar.Root>
			</Tooltip.Trigger>
			<Tooltip.Positioner>
				<Tooltip.Content>Segun Adebayo is online</Tooltip.Content>
			</Tooltip.Positioner>
		</Tooltip.Root>
	);
};
```

Both components share the same `id` through their `ids` props, creating proper accessibility bindings, `aria-*`
attributes and interaction behavior.

## Limitations

When using the `asChild` prop, ensure you pass only a single child element. Passing multiple children may cause
rendering issues.

Certain components, such as `Checkbox.Root` or `RadioGroup.Item`, have specific requirements for their child elements.
For instance, they may require a label element as a child. If you change the underlying element type, ensure it remains
accessible and functional.

===================================================

# Component State:

## Context Components

Context components expose state and functions to child components. In this example, `Avatar.Fallback` renders based on
`loaded` state.

**Example: context**

#### Svelte

```svelte
<script lang="ts">
	import { Avatar } from '@ark-ui/svelte/avatar';
</script>

<Avatar.Root>
	<Avatar.Context>
		{#snippet api(avatar)}
			<Avatar.Fallback>
				{#if avatar().loaded}
					<p>PA</p>
				{:else}
					<p>Loading</p>
				{/if}
			</Avatar.Fallback>
		{/snippet}
	</Avatar.Context>
	<Avatar.Image src="https://i.pravatar.cc/3000?u=b" alt="avatar" />
</Avatar.Root>
```

> **Good to know (RSC)**: Due to the usage of render prop, you might need to add the `'use client'` directive at the top
> of your file when using React Server Components.

## Provider Components

Provider components can help coordinate state and behavior between multiple components, enabling interactions that
aren't possible with `Context` components alone. They are used alongside component hooks.

**Example: root-provider**

#### Svelte

```svelte
<script>
	import { Accordion, useAccordion } from '@ark-ui/svelte/accordion';
	import { ChevronDownIcon } from 'lucide-svelte';

	const id = $props.id();
	const accordion = useAccordion({
		id,
		defaultValue: ['React']
	});
</script>

<div>
	<div>Open items: {JSON.stringify(accordion().value)}</div>
	<Accordion.RootProvider value={accordion}>
		{#each ['React', 'Solid', 'Vue', 'Svelte'] as item (item)}
			<Accordion.Item value={item}>
				<Accordion.ItemTrigger>
					What is {item}?
					<Accordion.ItemIndicator>
						<ChevronDownIcon />
					</Accordion.ItemIndicator>
				</Accordion.ItemTrigger>
				<Accordion.ItemContent>
					{item} is a JavaScript library for building user interfaces.
				</Accordion.ItemContent>
			</Accordion.Item>
		{/each}
	</Accordion.RootProvider>
</div>
```

> When using the `RootProvider` component, you don't need to use the `Root` component.

See more in [Examples](/examples/popover-selection).

===================================================

# Closed Components:

## Motivation

Writing a few lines of code every time you need a simple `Avatar` is tedious. Creating a dedicated component
encapsulates logic, simplifies the API, ensures consistent usage, and maintains clean code. This approach enhances
reusability, making the component easier to maintain and test.

Here's an example of an `Avatar` component that can be used consistently across your application:

**Example: closed**

#### Svelte

```svelte
<script lang="ts">
	import { Avatar, type AvatarRootBaseProps } from '@ark-ui/svelte/avatar';
	import { UserIcon } from 'lucide-svelte';

	interface Props extends AvatarRootBaseProps {
		name?: string | undefined;
		src?: string | undefined;
	}

	let { name, src, ...rootProps }: Props = $props();

	const getInitials = (name = '') =>
		name
			.split(' ')
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();

	const initials = $derived(getInitials(name));
</script>

<Avatar.Root {...rootProps}>
	<Avatar.Fallback>
		{#if initials}
			{initials}
		{:else}
			<UserIcon />
		{/if}
	</Avatar.Fallback>
	<Avatar.Image {src} alt={name} />
</Avatar.Root>
```

## Usage

To use the `Avatar` component, pass the `name` and `src` props as shown below:

```jsx
<Avatar name="Christian" src="https://avatars.githubusercontent.com/u/1846056?v=4" />
```

===================================================

# Animation:

Adding animation to Ark UI Components is as straightforward as with any other component, but keep in mind some
considerations when working with exit animations with JavaScript animation libraries.

## Animating with CSS

The most straightforward method to animate your elements is using CSS. You can animate both the mounting and unmounting
phases with CSS. The latter is achievable because Ark UI Components postpones the unmounting while your animation runs.

Below is a simple example of creating a fade-in and fade-out animation using CSS keyframes:

```css
@keyframes fadeIn {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}

@keyframes fadeOut {
	from {
		opacity: 1;
	}
	to {
		opacity: 0;
	}
}
```

You can use these keyframes to animate any element during its lifecycle. For instance, to apply the `fadeIn` animation
when your `Tooltip` enters the 'open' state, and `fadeOut` when it enters the 'closed' state, you could use the
following styles:

```css
[data-scope='tooltip'][data-part='content'][data-state='open'] {
	animation: fadeIn 300ms ease-out;
}

[data-scope='tooltip'][data-part='content'][data-state='closed'] {
	animation: fadeOut 300ms ease-in;
}
```

## Animating with JS Libraries

There's plenty of versatility when it comes to animating your Ark UI Elements with JavaScript libraries. Various
libraries such as GreenSock, anime.js, Framer Motion, and more can add a new level of interaction and feedback to your
UI components.

One significant advantage of using Ark UI Elements is the control you have over the unmounting phase of your components.
This is primarily facilitated through the `present` prop. The `present` prop allows the component to stay mounted even
after its enclosing condition has been falsified, allowing for exit animations to complete before the component is
removed from the DOM.
