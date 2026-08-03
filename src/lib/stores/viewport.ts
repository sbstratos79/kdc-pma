import { writable, type Writable } from 'svelte/store';

// Design resolution the dashboard is laid out at before scaling up.
// Scaling only kicks in above this size; smaller viewports are unchanged.
export const DESIGN_WIDTH = 1536;
export const DESIGN_HEIGHT = 864;

export type ViewportState = {
	width: number;
	height: number;
	scale: number;
	layoutWidth: number;
	layoutHeight: number;
};

const IS_BROWSER = typeof window !== 'undefined';

function compute(w: number, h: number): ViewportState {
	const scale = Math.max(1, Math.min(w / DESIGN_WIDTH, h / DESIGN_HEIGHT));
	return {
		width: w,
		height: h,
		scale,
		layoutWidth: w / scale,
		layoutHeight: h / scale
	};
}

const store: Writable<ViewportState> = writable(
	IS_BROWSER ? compute(window.innerWidth, window.innerHeight) : compute(DESIGN_WIDTH, DESIGN_HEIGHT)
);

let initialized = false;

function init() {
	if (!IS_BROWSER || initialized) return;
	initialized = true;
	const update = () => store.set(compute(window.innerWidth, window.innerHeight));
	update();
	window.addEventListener('resize', update);
	if (window.visualViewport) {
		window.visualViewport.addEventListener('resize', update);
	}
}

export const viewportStore = {
	subscribe(run: (value: ViewportState) => void) {
		init();
		return store.subscribe(run);
	}
};
