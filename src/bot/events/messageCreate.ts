import { BigString, Bot, Message } from "@discordeno/bot";
import { Environment } from "../../types/other.js";
import { NoCooldown } from "../config/setup.js";
import { commands } from "../index.js";
import { Command } from "../types/command.js";
import { checkCooldown } from "../utils/cooldown.js";
import { env, getCache, premium, setCache, voted } from "../utils/db.js";

export const MentionRegex = (id: BigString) => new RegExp(`^<@!?${id}>\\s*$`);

export const messageCreate = async (message: Message, bot: Bot) => {
  if (messageBot(message)) return;

  const regex = MentionRegex(bot.id);
  const mentionsBot = message.mentions?.find((m) => m.id === bot.id)
    ? true
    : false;
  if (!mentionsBot && message.guildId) {
    // message response for only mention
    // @chat-gpt
    console.log("no trigger", message.content, mentionsBot);
    responseInfo(message);
    return;
  }

  const getter = getCommandArgs(message, regex);
  if (!getter) return;
  const [commandName, args] = getter;

  if (!commandName) return;

  const command = commands.get(commandName) ?? commands.get("chat")!;

  if (!command.message) return;
  const environment = await env(
    message.author.id.toString(),
    message.guildId?.toString()
  );
  if (!environment) return;
  await bot.helpers.triggerTypingIndicator(message.channelId);
  const prem = await premium(environment);

  if (!(await manageCooldown(bot, message, environment, command))) return;

  let previousMetrics: any = (await getCache("metrics_shapes")) || {
    users: [],
    guilds: [],
    messages: 0,
  };
  let userIsThere = previousMetrics?.users.find(
    (u: string) => u === message.author.id
  );
  if (!userIsThere) {
    previousMetrics?.users.push(message.author.id);
  }
  let guildIsThere = previousMetrics?.guilds.find(
    (g: string) => g === message.guildId
  );
  if (!guildIsThere) {
    previousMetrics?.guilds.push(message.guildId);
  }
  await setCache("metrics_shapes", previousMetrics);
  await command
    .message({ bot, message, args, env: environment, premium: prem })
    .catch((err) => {
      bot.logger.error(
        `There was an error trying to execute the command ${command.body.name}`
      );
      bot.logger.error("A detailed walkthrough is provided below.");
      bot.logger.error(err);
    });
};

export function messageBot(message: Message) {
  if (!message.content?.length) return true;
  if (message.author.bot || message.webhookId) return true;
  return false;
}

export function getCommandArgs(
  message: Message,
  regex: RegExp
): [command: string, args: string[]] | undefined {
  const args = message.content
    .trim()
    .split(/ +/)
    .filter((a) => !!a);
  let commandName = args[0];
  if (message.guildId) {
    const mentionIndex = args.findIndex((a) => !!a.match(regex)?.[0]);
    if (mentionIndex != -1) {
      // 0 or max args for compatibility with arabian
      if (![0, args.length].includes(mentionIndex)) return;
      delete args[mentionIndex];
      commandName = args.shift()!;
    }
    2;
    if (!commandName) commandName = "chat";
  } else {
    commandName = "chat";
  }
  if (args.length === 0) commandName = "bot";
  return [commandName, args];
}

export async function responseInfo(_message: Message) {}

export async function checkStatus(environment: Environment) {
  let status: keyof typeof NoCooldown | "plan" = "user";

  const hasVote = voted(environment.user);

  if (hasVote) status = "voter";

  const prem = await premium(environment);
  if (prem) status = prem.type;

  return status;
}

export function errorCallback(
  bot: Bot,
  cmd: Command,
  err: NonNullable<unknown>
) {
  bot.logger.error(
    `There was an error trying to execute the command ${cmd.body.name}`
  );
  bot.logger.error("A detailed walkthrough is provided below.");
  bot.logger.error(err);
}

export async function manageCooldown(
  bot: Bot,
  message: Message,
  environment: Environment,
  cmd: Command
) {
  const status = await checkStatus(environment);

  if (status === "plan") return true;

  const hasCooldown = await checkCooldown(message.author.id, cmd, status);
  if (hasCooldown) {
    await bot.helpers.sendMessage(message.channelId, {
      ...hasCooldown,
      messageReference: {
        failIfNotExists: false,
        messageId: message.id,
      },
    });
    return;
  }

  return true;
}
