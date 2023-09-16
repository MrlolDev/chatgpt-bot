import { createLogger } from "@discordeno/utils";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import RabbitMQ from "rabbitmq-client";
import { createClient as createRedisClient } from "redis";
import { DB_KEY, DB_URL, RABBITMQ_URI, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USER } from "../config.js";

import { CollectionName, CollectionNames } from "../types/collections.js";

const logger = createLogger({ name: "[DB]" });

var queue = "db";
if (process.env.NODE_ENV === "development") queue = "db-dev";

/** Redis client */
const redis = createRedisClient({
	socket: {
		host: REDIS_HOST,
		port: REDIS_PORT,
	},

	username: REDIS_USER,
	password: REDIS_PASSWORD,
});
redis.connect()
	.then(() => {
		logger.info("Redis connected");
	}).catch
	((error) => {
		logger.error(error);
	});

/** Supabase client */
const db = createSupabaseClient(DB_URL, DB_KEY, {
	auth: {
		persistSession: false,
	},
});
// check if supabase is connected
db.auth.onAuthStateChange((_, session) => {
	if (session) logger.info("Connected to Supabase");
	else logger.info("Disconnected from Supabase");
});

/** RabbitMQ connection */
const connection = new RabbitMQ.Connection(RABBITMQ_URI);

connection.on("connection", () => {
	logger.info("Connected to RabbitMQ");
});

/** Cache */
async function getCache<T>(key: string): Promise<T | null> {
	const existing: string | null = (await redis.get(key)) ?? null;

	if (existing !== null) return JSON.parse(existing);
	else return null;
}

async function setCache<T>(key: string, data: T) {
	await redis.set(key, JSON.stringify(data), {
		EX: 30 * 60,
	});
}

function getCollectionKey(collection: CollectionName, id: string) {
	return `${collection}::${id}`;
}

/** Actions */
async function update(collection: CollectionName, id: string, data: NonNullable<unknown>) {
	const collectionKey = getCollectionKey(collection, id);
	let existing = await getCache(collectionKey);
	if (!existing) {
		existing = await db.from(collection).select("*").eq("id", id).single();
		if (!existing) {
			existing = await db
				.from(collection)
				.insert({ id, ...data })
				.single();
			await setCache(collectionKey, existing);
			return;
		}
	}
	await db
		.from(collection)
		.update({ ...data })
		.eq("id", id);
	await setCache(collectionKey, { ...existing, ...data });
}

async function insert(collection: CollectionName, id: string, data: NonNullable<unknown>) {
	const collectionKey = getCollectionKey(collection, id);
	let existing = await getCache(collectionKey);
	if (!existing) {
		existing = await db.from(collection).select("*").eq("id", id).single();
		if (existing) {
			await setCache(collectionKey, existing);
			return;
		}
		await db.from(collection).insert({ id, ...data });
		await setCache(collectionKey, { id, ...data });
	}
}

async function remove(collection: CollectionName, id: string) {
	const collectionKey = getCollectionKey(collection, id);
	await db.from(collection).delete().eq("id", id);
	await redis.del(collectionKey);
}

/** Handlers */
connection.createConsumer(
	{
		queue: queue,
	},
	async (message, reply) => {
		try {
			const result = await handleMessage(message.body);
			if (result) await reply({ success: true, data: result });
		} catch (error) {
			logger.error(error);

			await reply({
				success: false,
				error: (error as Error).toString(),
			});
		}
	},
);

async function handleMessage(message: {
	action: "update" | "insert" | "remove";
	collection: CollectionName;
	id: string;
	data: NonNullable<unknown>;
}) {
	// no borres el comentario cabrón.
	// biome-ignore lint/complexity/useSimplifiedLogicExpression: spaghetti code by lol
	if (!message.action || !message.collection || !message.id || !message.data) throw new Error(`Invalid message: ${message}`);
	if (!Object.keys(CollectionNames).includes(message.collection)) throw new Error(`Invalid collection name: ${message.collection}`);
	switch (message.action) {
		case "update":
			await update(message.collection, message.id, message.data);
			break;

		case "insert":
			await insert(message.collection, message.id, message.data);
			break;
		case "remove":
			await remove(message.collection, message.id);
			break;
	}
	return null;
}
