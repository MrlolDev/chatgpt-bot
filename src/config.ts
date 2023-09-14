import { Intents } from "@discordeno/types";
import dotenv from "dotenv";
import { CommandCooldown } from "./bot/types";
dotenv.config();

/** Token & ID of the bot */
export const BOT_TOKEN = process.env.BOT_TOKEN!;
export const BOT_ID = process.env.BOT_ID!;

/** Load distribution */
export const TOTAL_WORKERS = Number(process.env.TOTAL_WORKERS!);
export const TOTAL_SHARDS = Number(process.env.TOTAL_SHARDS!);
export const SHARDS_PER_WORKER = Number(process.env.SHARDS_PER_WORKER!);

/** REST server */
export const REST_URL = `${process.env.REST_HOST}:${process.env.REST_PORT}`;
export const REST_PORT = process.env.REST_PORT!;

/** Gateway HTTP server */
export const GATEWAY_URL = `${process.env.GATEWAY_HOST}:${process.env.GATEWAY_PORT}`;
export const GATEWAY_PORT = process.env.GATEWAY_PORT!;
export const GATEWAY_AUTH = process.env.GATEWAY_AUTH!;

/** Authentication for the HTTP services */
export const REST_AUTH = process.env.REST_AUTH!;

/** RabbitMQ server URI */
export const RABBITMQ_URI = process.env.RABBITMQ_URI!;

/** Redis connection */
export const REDIS_HOST = process.env.REDIS_HOST!;
export const REDIS_USER = process.env.REDIS_USER;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

/** Supabase authentication */
export const DB_URL = process.env.DB_URL!;
export const DB_KEY = process.env.DB_KEY!;

/** Turing API keys */
export const TURING_API_KEY = process.env.TURING_API_KEY!;
export const TURING_CAPTCHA_KEY = process.env.TURING_CAPTCHA_KEY!;
export const TURING_SUPER_KEY = process.env.TURING_SUPER_KEY!;
export const TURING_HOST = process.env.TURING_HOST;

/** How often to save database changes, in seconds */
export const DB_QUEUE_INTERVAL = Number(process.env.DB_QUEUE_INTERVAL!);

/** Support server invite code */
export const SUPPORT_INVITE = `discord.gg/${process.env.SUPPORT_INVITE_CODE!}`;

/* Color to use for most embeds */
export const BRANDING_COLOR = parseInt(process.env.BRANDING_COLOR!, 16);

/** Which gateway intents should be used */
export const INTENTS = Intents.DirectMessages | Intents.GuildMessages;

/** Turing partners */
export const PARTNERS = [
	{
		emoji: "<:trident:1128664558425362522>",
		name: "TridentNodes",
		url: "https://link.turing.sh/tridentnodes",
		description: "Reliable, powerful, affordable hosting",
	},
	{
		emoji: "<:runpod:1121108621170839592>",
		name: "RunPod",
		url: "https://link.turing.sh/runpod",
		description: "Providing various GPU models for the bot, like image recognition",
	},
];

/** Home repo */
export const HOME_REPO = "https://github.com/TuringAI-Team/chatgpt-discord-bot";

export const NoCooldown: CommandCooldown = {
	user: 0,
	voter: 0,
	subscription: 0,
};
