import { createLogger } from "@discordeno/utils";
import { createClient } from "redis";
import type { ShardInfo } from "../../types/other.js";
import API from "../api.js";

declare module "@discordeno/bot" {
	interface Bot {
		/** Bot logger */
		logger: ReturnType<typeof createLogger>;

		/** Redis connection */
		redis: ReturnType<typeof createClient>;

		/** Turing API */
		api: typeof API;

		/**
		 * Shard Data
		 */
		shards: Map<number, ShardInfo>;
	}
}

export type MakeRequired<R, K extends keyof R> = R & { [P in K]-?: R[P] };