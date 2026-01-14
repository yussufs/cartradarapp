// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { Session } from '@shopify/shopify-api';
import type { AdminClient } from '$lib/server/shopify/graphql';

declare global {
	namespace App {
		interface Error {
			message: string;
		}

		interface Locals {
			shopify?: {
				session: Session;
				admin: AdminClient;
			};
		}

		interface PageData {
			apiKey?: string;
			shop?: string;
		}

		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		shopify?: {
			toast: {
				show: (message: string) => void;
			};
			idToken: () => Promise<string>;
			intents?: {
				invoke?: (intent: string, options: { value: string }) => void;
			};
		};
	}
}

export {};
