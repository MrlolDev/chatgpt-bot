import { TuringConnectionManager } from "./turing/connection/connection.js";
import { executeConfigurationSteps } from "./bot/setup.js";
import { CacheManager } from "./bot/managers/cache.js";
import { AppDatabaseManager } from "./db/app.js";
import { BotManager } from "./bot/manager.js";
import { Logger } from "./util/logger.js";
import { Config } from "./config.js";

enum AppState {
	/* The app is not initialized yet */
	Stopped,

	/* The app is currently starting up */
	Starting,

	/* The app is up & running */
	Running
}

/* Stripped-down app data */
export interface StrippedApp {
	/* Configuration data */
	config: Config;
}

export class App {
    /* Logging instance */
    public readonly logger: Logger;

	/* Manager, in charge of managing the Discord bot & their shards */
	public readonly manager: BotManager;

	/* Global cache manager */
	public readonly cache: CacheManager;

	/* Database manager */
	public readonly db: AppDatabaseManager;

	/* Turing connection manager */
	public readonly connection: TuringConnectionManager;

	/* Configuration data */
	public config: Config;

	/* Current initialization state */
	public state: AppState;

	/* When the app was started */
	public started: number;

    constructor() {
        this.logger = new Logger();

		/* Set up various managers & services. */
		this.connection = new TuringConnectionManager(this);
		this.db = new AppDatabaseManager(this);
		this.manager = new BotManager(this);
		this.cache = new CacheManager(this);

        /* Assign a temporary value to the config, while we wait for the application start.
           Other parts *shouldn't* access the configuration during this time. */
        this.config = null!;

		/* Set the default, stopped state of the app. */
		this.state = AppState.Stopped;
		this.started = Date.now();
    }

    /**
     * Set up the application & all related services.
     * @throws An error, if something went wrong
     */
    public async setup(): Promise<void> {
		this.state = AppState.Starting;

		/* Execute all configuration steps for the app. */
		await executeConfigurationSteps(this, "app");

		this.state = AppState.Running;
    }

	/**
     * Shut down the application & all related services.
     */
	public async stop(code: number = 0): Promise<void> {
		/* First, save the pending database changes. */
		await this.db.queue.work();

		/* Close the RabbitMQ connection. */
		await this.connection.stop();

		this.state = AppState.Stopped;

		/* Exit the process. */
		process.exit(code);
	}

    /**
     * Whether development mode is enabled
     */
    public get dev(): boolean {
        return this.config ? this.config.dev : false;
    }

	/**
	 * Get a stripped-down interface of this class.
	 * @returns Stripped-down app
	 */
	public strip(): StrippedApp {
		return {
			config: this.config
		};
	}
}