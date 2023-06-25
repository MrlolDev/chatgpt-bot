import chalk from "chalk";
import dayjs from "dayjs";

import { Bot } from "../bot/bot.js";

export type LogType = string | number | boolean | any

interface LogLevel {
	name: string;
	color: string;
}

export const LogLevels: Record<string, LogLevel> = {
	INFO:  { name: "info",  color: "#00aaff" },
	WARN:  { name: "warn",  color: "#ffff00" },
	ERROR: { name: "error", color: "#ff3300" },
	DEBUG: { name: "debug", color: "#00ffaa" }
}

export class Logger {
	/**
	 * Log a message to the console.
	 * 
	 * @param level Log level
	 * @param message Message to log to the console
	 */
	public log(level: LogLevel, message: LogType[]): void {
        const now: number = Math.floor(Date.now() / 1000);
        const time: string = dayjs.unix(now).format("hh:mm A");

		const status: string = chalk.bold.hex(level.color)(level.name);
		const line: string = `${status} ${chalk.italic(chalk.gray(time))} ${chalk.gray("»")}`;

		/* Log the message to the console. */
		this.printToConsole(line, ...message);
	}

	public debug(...message: LogType) { this.log(LogLevels.DEBUG, message); }
	public info(...message: LogType)  { this.log(LogLevels.INFO, message);  }
	public warn(...message: LogType)  { this.log(LogLevels.WARN, message);  }
	public error(...message: LogType) { this.log(LogLevels.ERROR, message); }

	protected printToConsole(...message: LogType): void {
		console.log(...message);
	}
}

export class ClusterLogger extends Logger {
	/* Discord client instance */
	private readonly bot: Bot;

	constructor(bot: Bot) {
		super();
		this.bot = bot;
	}

	/**
	 * Log a message to the console.
	 * 
	 * @param level Log level
	 * @param message Message to log to the console
	 */
	public log(level: LogLevel, message: LogType[]): void {
        const now: number = Math.floor(Date.now() / 1000);
        const time: string = dayjs.unix(now).format("hh:mm A");

		const status: string = chalk.bold.hex(level.color)(level.name);
		const line: string = `${chalk.green(chalk.bold(`#${this.bot.data.id + 1}`))} ${chalk.gray("»")} ${status} ${chalk.italic(chalk.gray(time))} ${chalk.gray("»")}`.trim();

		/* Log the message to the console. */
		this.printToConsole(line, ...message);
	}
}