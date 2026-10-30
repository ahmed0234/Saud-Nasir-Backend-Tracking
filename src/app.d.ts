// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			/** Registered websites, from the (app) layout (absent on /login). */
			websites?: import('#lib/sites.ts').Website[];
			/** This app's origin, where websites load the tracker from (install codes). */
			trackerOrigin?: string;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
