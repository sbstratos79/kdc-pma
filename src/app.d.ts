// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			authenticated: boolean;
		}
		interface PageData {
			authenticated: boolean;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
