import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import RabbitMQ from "rabbitmq-client";
import { createClient as createRedisClient } from "redis";
import config from "../../config.js";

import { CollectionName, CollectionNames } from "../../types/collections.js";
import { Guild } from "../../types/models/guilds.js";
import { Role, User } from "../../types/models/users.js";
import { Environment } from "../../types/other.js";
import { getDefaultUserSettings, getSettingsValue } from "./settings.js";

let queue = "db";
if (process.env.NODE_ENV === "development") queue = "db-dev";
/** Redis client */
export const redis = createRedisClient({
	socket: {
		host: config.database.redis.host,
		port: config.database.redis.port,
	},

	password: config.database.redis.password,
});

/** Supabase client */
const db = createSupabaseClient(config.database.supabase.url, config.database.supabase.key, {
	auth: {
		persistSession: false,
	},
});
export { db as supabase };

/** RabbitMQ connection */
export const connection = new RabbitMQ.Connection(config.rabbitmq.uri);
connection.on("connection", () => {
	console.info("RabbitMQ connected");
});

const publisher = connection.createPublisher();
async function sendQuery(body: NonNullable<unknown>) {
	await publisher.send(queue, body);
}

/** Cache */
export async function setCache<T>(key: string, data: T, EX = 6e5) {
	await redis.set(key, JSON.stringify(data), {
		EX,
	});
}
export async function setCacheEX<T>(key: string, data: T, EX = 6e5) {
	await redis.setEx(key, EX, JSON.stringify(data));
}

export async function getCache<T>(key: string): Promise<T | null> {
	const existing: string | null = await redis.get(key);

	return typeof existing === "string" ? JSON.parse(existing) : null;
}

export function getCollectionKey(collection: string, id: string, extra?: string) {
	if (extra) return `${collection}::${id}::${extra}`;
	else return `${collection}::${id}`;
}

/** Actions */

export async function update(collection: CollectionName, id: string, data: NonNullable<unknown>) {
	const body = {
		type: "update",
		collection,
		id,
		data,
	};
	const result = await sendQuery(body);
	return result;
}

export async function insert(collection: CollectionName, data: NonNullable<unknown>, id?: string) {
	let body: {
		type: "insert";
		collection: CollectionName;
		data: NonNullable<unknown>;
		id?: string;
	} = {
		type: "insert",
		collection: collection,
		data,
	};
	if (id) body = { ...body, id };
	const result = await sendQuery(body);
	return result;
}

export type GetParams<T = string | undefined> = {
	collection: CollectionName;
	id?: T;
	/*
	filter?: Array<{
		column: string;
		operator: string;
		value: string;
	}>;*/
	filter?: {
		[key: string]: string | number | boolean | null;
	};
};

export async function get(params: GetParams): Promise<NonNullable<unknown>>;
export async function get(params: GetParams<string>): Promise<NonNullable<unknown>>;
export async function get(params: GetParams | GetParams<string>) {
	let collection: string = params.collection;
	if (CollectionNames[params.collection]) collection = CollectionNames[params.collection];

	if (params.id) {
		const collectionKey = getCollectionKey(params.collection, params.id);
		const existing = await getCache(collectionKey);
		if (existing) return existing;
		const { data: result } = await db.from(collection).select("*").eq("id", params.id).single();
		if (!result) return null;
		await setCache(collectionKey, result);
		return result;
	} else if (params.filter) {
		const { data: result } = await db.from(collection).select("*").match(params.filter);
		return result;
	} else {
		const { data: result } = await db.from(collection).select("*");
		return result;
	}
}

export async function env(userId: string, guildId?: string) {
	let guild: NonNullable<unknown> | null = null;
	let user = await get({
		collection: "users",
		id: userId,
	});
	if (!user) {
		const settings = await getDefaultUserSettings(false);
		const newUser: User = {
			id: userId,
			moderator: false,
			interactions: {},
			infractions: [],
			subscription: null,
			plan: null,
			voted: null,
			settings_new: settings ?? [],
			settings: {},
			metadata: {},
			roles: [],
			created: new Date(),
		};
		await insert("users", newUser, userId);
		user = newUser;
	}
	if (guildId) {
		guild = await get({
			collection: "guilds",
			id: guildId,
		});
		if (!guild) {
			await insert(
				"guilds",
				{
					subscription: null,
					plan: null,
					settings: {},
					infractions: [],
					metadata: null,
				},
				guildId,
			);
			guild = {
				id: guildId,
				subscription: null,
				plan: null,
				settings: {},
				infractions: [],
				metadata: null,
			};
		}
	}
	const result = {
		user: user,
		guild: guild,
	} as Environment;
	return result;
}

export async function premium(env: Environment): Promise<{
	type: "plan" | "subscription";
	location: "user" | "guild";
} | null> {
	/* In which order to use the plans in */
	const locationPriority: "guild" | "user" = (await getSettingsValue(env.user, "premium:locationPriority")) as "guild" | "user";

	/* Whether to prefer the Premium of the guild or user itself */
	const typePriority: "plan" | "subscription" = (await getSettingsValue(
		env.guild ? env[locationPriority]! : env.user,
		"premium:typePriority",
	)) as "plan" | "subscription";

	const checks: Record<typeof typePriority, (entry: Guild | User) => boolean> = {
		subscription: (entry) => entry.subscription !== null && Date.now() < entry.subscription?.expires,
		plan: (entry) => entry.plan !== null && entry.plan?.total > entry.plan?.used + 0.01,
	};

	const locations: typeof locationPriority[] = ["guild", "user"];
	const types: typeof typePriority[] = ["plan", "subscription"];

	if (locationPriority !== locations[0]) locations.reverse();
	if (typePriority !== types[0]) types.reverse();

	for (const type of types) {
		for (const location of locations) {
			const entry = env[location];
			if (!entry) continue;
			if (checks[type](entry))
				return {
					location,
					type,
				};
		}
	}

	return null;
}

export function voted(user: User): number | null {
	if (!user.voted) return null;
	if (Date.now() - Date.parse(user.voted) > 45e6) return null;

	return Date.parse(user.voted);
}

export async function icon(env: Environment) {
	if (env.user?.roles.includes(Role.Moderator)) return "⚒️";
	const p = await premium(env);

	if (p) {
		if (p.type === "plan" && p.location === "user") return "📊";
		if (p.type === "subscription" && p.location === "user") return "✨";
		if (p.location === "guild") return "💫";
	}

	const votedAt = voted(env.user);

	if (votedAt) {
		if (votedAt + 45e6 - Date.now() < 18e5) return "📩";
		else return "✉️";
	}

	return "👤";
}

export async function remove(collection: CollectionName, id: string) {
	const result = await sendQuery({
		type: "remove",
		collection,
		id,
	});
	return result;
}
await redis
	.connect()
	.then(() => {
		console.info("Redis connected");
	})
	.catch((error) => {
		console.error(error);
	});
