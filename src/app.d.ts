// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="@shopify/app-bridge-types" />

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
}

export {};
