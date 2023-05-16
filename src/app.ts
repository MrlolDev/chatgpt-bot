import chalk from "chalk";

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
  Running,
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

  /* Configuration data */
  public config: Config;

  /* Current initialization state */
  public state: AppState;

  constructor() {
    this.logger = new Logger();

    /* Set up various managers & services. */
    this.db = new AppDatabaseManager(this);
    this.manager = new BotManager(this);
    this.cache = new CacheManager(this);

    /* Assign a temporary value to the config, while we wait for the application start.
           Other parts *shouldn't* access the configuration during this time. */
    this.config = null!;

    /* Set the default, stopped state of the app. */
    this.state = AppState.Stopped;
  }

  /**
   * Set up the application & all related services.
   * @throws An error, if something went wrong
   */
  public async setup(): Promise<void> {
    this.state = AppState.Starting;

    /* Load the configuration. */
    await import("./config.json", {
      assert: {
        type: "json",
      },
    })
      .then((data) => (this.config = data.default as any))
      .catch((error) => {
        this.logger.error(
          `Failed to load configuration -> ${chalk.bold(error.message)}`
        );
        this.stop(1);
      });
    this.logger.info(`Loaded configuration from ${chalk.bold("config.json")}`);
    /* Initialize the sharding manager. */
    await this.manager.setup().catch((error) => {
      this.logger.error(
        `Failed to set up the bot sharding manager -> ${chalk.bold(
          error.message
        )}`
      );
      this.stop(1);
    });
    this.logger.info(`Set up the bot sharding manager`);
    /* Initialize the database manager. */
    await this.db.setup().catch((error) => {
      this.logger.error(
        `Failed to set up the database manager -> ${chalk.bold(error.message)}`
      );
      this.stop(1);
    });
    this.logger.info(`Set up the database manager`);
    this.state = AppState.Running;
  }

  /**
   * Shut down the application & all related services.
   */
  public async stop(code: number = 0): Promise<void> {
    this.state = AppState.Stopped;

    /* Exit the process. */
    process.exit(code);
  }

  /**
   * Get a stripped-down interface of this class.
   * @returns Stripped-down app
   */
  public strip(): StrippedApp {
    return {
      config: this.config,
    };
  }
}
