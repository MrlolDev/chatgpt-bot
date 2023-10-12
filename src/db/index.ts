import { createLogger } from "@discordeno/utils";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import RabbitMQ from "rabbitmq-client";
import { createClient as createRedisClient } from "redis";
import config from "../config.js";

import { CollectionName, CollectionNames } from "../types/collections.js";

const logger = createLogger({ name: "[DB]" });

let queue = "db";
if (process.env.NODE_ENV === "development") queue = "db-dev";

/** Redis client */
const redis = createRedisClient({
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

/** RabbitMQ connection */
const connection = new RabbitMQ.Connection(config.rabbitmq.uri);

connection.on("connection", () => {
	logger.info("Connected to RabbitMQ");
});

/** Cache */
async function getCache<T>(key: string): Promise<T | null> {
	const existing: string | null = await redis.get(key);

	return typeof existing === "string" ? JSON.parse(existing) : null;
}

async function setCache<T>(key: string, data: T) {
	await redis.set(key, JSON.stringify(data), {
		EX: 60 * 30,
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
	async (message, _reply) => {
		console.log(message);
		try {
			await handleMessage(message.body);
		} catch (error) {
			logger.error(JSON.stringify(error));

			/*await reply({
				success: false,
				error: (error as Error).toString(),
			});*/
		}
	},
);

async function handleMessage(message: {
	action: "update" | "insert" | "remove";
	collection: CollectionName;
	id: string;
	data: NonNullable<unknown>;
}) {
	for (const [k, v] of Object.entries(message)) {
		if (!v) console.log(`Invalid message: ${k} is ${v}`);
		if (!(k === "collection" && CollectionNames[k as keyof typeof CollectionNames]))
			throw new Error(`Invalid collection name: ${message.collection}`);
	}
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
redis
	.connect()
	.then(() => {
		logger.info("Redis connected");
	})
	.catch((error) => {
		logger.error(`Redis connection failed: ${error}`);
	});