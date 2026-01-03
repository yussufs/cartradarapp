import { Session } from '@shopify/shopify-api';
import { db } from '$lib/server/db';
import { session as sessionTable } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

// SessionStorage interface based on Shopify's requirements
export interface SessionStorage {
	storeSession(session: Session): Promise<boolean>;
	loadSession(id: string): Promise<Session | undefined>;
	deleteSession(id: string): Promise<boolean>;
	deleteSessions(ids: string[]): Promise<boolean>;
	findSessionsByShop(shop: string): Promise<Session[]>;
}

export class DrizzleSessionStorage implements SessionStorage {
	async storeSession(session: Session): Promise<boolean> {
		const sessionData = {
			id: session.id,
			shop: session.shop,
			state: session.state,
			isOnline: session.isOnline,
			scope: session.scope ?? null,
			expires: session.expires ?? null,
			accessToken: session.accessToken ?? '',
			userId: session.onlineAccessInfo?.associated_user?.id?.toString() ?? null,
			firstName: session.onlineAccessInfo?.associated_user?.first_name ?? null,
			lastName: session.onlineAccessInfo?.associated_user?.last_name ?? null,
			email: session.onlineAccessInfo?.associated_user?.email ?? null,
			accountOwner: session.onlineAccessInfo?.associated_user?.account_owner ?? false,
			locale: session.onlineAccessInfo?.associated_user?.locale ?? null,
			collaborator: session.onlineAccessInfo?.associated_user?.collaborator ?? false,
			emailVerified: session.onlineAccessInfo?.associated_user?.email_verified ?? false
		};

		await db
			.insert(sessionTable)
			.values(sessionData)
			.onConflictDoUpdate({
				target: sessionTable.id,
				set: sessionData
			});

		return true;
	}

	async loadSession(id: string): Promise<Session | undefined> {
		const rows = await db.select().from(sessionTable).where(eq(sessionTable.id, id)).limit(1);

		if (rows.length === 0) {
			return undefined;
		}

		const row = rows[0];
		return this.rowToSession(row);
	}

	async deleteSession(id: string): Promise<boolean> {
		await db.delete(sessionTable).where(eq(sessionTable.id, id));
		return true;
	}

	async deleteSessions(ids: string[]): Promise<boolean> {
		if (ids.length === 0) return true;
		await db.delete(sessionTable).where(inArray(sessionTable.id, ids));
		return true;
	}

	async findSessionsByShop(shop: string): Promise<Session[]> {
		const rows = await db.select().from(sessionTable).where(eq(sessionTable.shop, shop));

		return rows.map((row) => this.rowToSession(row));
	}

	private rowToSession(row: typeof sessionTable.$inferSelect): Session {
		const sessionParams: ConstructorParameters<typeof Session>[0] = {
			id: row.id,
			shop: row.shop,
			state: row.state,
			isOnline: row.isOnline,
			scope: row.scope ?? undefined,
			expires: row.expires ?? undefined,
			accessToken: row.accessToken,
			onlineAccessInfo: row.userId
				? {
						expires_in: 0,
						associated_user_scope: row.scope ?? '',
						associated_user: {
							id: Number(row.userId),
							first_name: row.firstName ?? '',
							last_name: row.lastName ?? '',
							email: row.email ?? '',
							email_verified: row.emailVerified ?? false,
							account_owner: row.accountOwner ?? false,
							locale: row.locale ?? '',
							collaborator: row.collaborator ?? false
						}
					}
				: undefined
		};

		return new Session(sessionParams);
	}
}
