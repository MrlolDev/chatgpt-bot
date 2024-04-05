import {
  BigString,
  Bot,
  EventHandlers,
  Interaction,
  InteractionResponse,
  InteractionResponseTypes,
  InteractionTypes,
  MessageComponentTypes,
  MessageFlags,
  logger,
} from "@discordeno/bot";
import { Environment } from "../../types/other.js";
import { NoCooldown } from "../config/setup.js";
import { OptionResolver } from "../handlers/OptionResolver.js";
import { buttons, commands } from "../index.js";
import { MakeRequired } from "../types/bot.js";
import { Command } from "../types/command.js";
import { checkCooldown } from "../utils/cooldown.js";
import { env, getCache, premium, setCache, voted } from "../utils/db.js";

export const interactionCreate: EventHandlers["interactionCreate"] = async (
  interaction
) => {
  switch (interaction.type) {
    case InteractionTypes.ApplicationCommand:
      if (!interaction.data) return;
      handleCommand(interaction as MakeRequired<Interaction, "data">);
      break;
    case InteractionTypes.MessageComponent:
      if (!interaction.data) return;
      if (!interaction.data.customId) return;
      switch (interaction.data.componentType) {
        case MessageComponentTypes.Button:
          handleButton(interaction as MakeRequired<Interaction, "data">);
        case MessageComponentTypes.SelectMenu:
          handleButton(interaction as MakeRequired<Interaction, "data">);
      }
  }
};

export async function handleCommand(
  interaction: MakeRequired<Interaction, "data">
) {
  const cmd = commands.get(interaction.data.name);

  if (!cmd) {
    return logger.error("Command not found (why is the command registered...)");
  }

  const environment = await env(
    interaction.user.id.toString(),
    interaction.guildId?.toString()
  );
  if (!environment) return;
  const prem = await premium(environment);

  await interaction.defer(cmd.isPrivate ?? false);

  if (!(await manageCooldown(interaction, environment, cmd))) return;

  const options = new OptionResolver(
    interaction.data.options ?? [],
    interaction.data.resolved!
  );
  let previousMetrics: any = (await getCache("metrics_shapes")) || {
    users: [],
    guilds: [],
    messages: 0,
  };
  let userIsThere = previousMetrics?.users.find(
    (u: string) => u === interaction.user.id.toString()
  );
  if (!userIsThere) {
    previousMetrics?.users.push(interaction.user.id.toString());
  }
  let guildIsThere = previousMetrics?.guilds.find(
    (g: string) => g === interaction.guildId.toString()
  );
  if (!guildIsThere) {
    previousMetrics?.guilds.push(interaction.guildId.toString());
  }
  await setCache("metrics_shapes", previousMetrics);
  await cmd
    .interaction({ interaction, options, env: environment, premium: prem })
    .catch((err) => errorCallback(interaction, err));
}

export async function handleButton(
  interaction: MakeRequired<Interaction, "data">
) {
  const name = interaction.data.customId!.split("_");
  const button = buttons.get(name.shift()!);
  if (!button) {
    return logger.error(
      "ButtonResponse not found (why this button was sent...)"
    );
  }
  let deferType = button.deferType;
  if (button.id === "settings" && interaction.data.values?.length) {
    deferType = InteractionResponseTypes.DeferredUpdateMessage;
  }
  await deferInteraction(
    interaction.bot,
    interaction.id,
    interaction.token,
    deferType,
    button.isPrivate
  );
  interaction.acknowledged = true;
  const args = name.reduce(
    (prev, acc, i) => {
      prev[button.args[i]] = acc;
      return prev;
    },
    {} as Record<string, string>
  );

  await button.run(interaction, args);
}

export async function checkStatus(environment: Environment) {
  let status: keyof typeof NoCooldown | "plan" = "user";

  const hasVote = voted(environment.user);

  if (hasVote) status = "voter";

  const prem = await premium(environment);
  if (prem) status = prem.type;

  return status;
}

export function errorCallback(
  interaction: Interaction,
  err: NonNullable<unknown>
) {
  interaction.bot.logger.error(
    `There was an error trying to execute the command ${interaction.data?.name}`
  );
  interaction.bot.logger.error("A detailed walkthrough is provided below.");
  interaction.bot.logger.error(err);
}

export async function manageCooldown(
  interaction: Interaction,
  environment: Environment,
  cmd: Command
) {
  const status = await checkStatus(environment);
  if (status === "plan") return true;

  const hasCooldown = await checkCooldown(interaction.user.id, cmd, status);

  if (hasCooldown) {
    await interaction.edit(hasCooldown);
    return;
  }

  return true;
}

// discordeno for no reason has a bad handle about defers
export async function deferInteraction(
  bot: Bot,
  id: BigString,
  token: string,
  type:
    | InteractionResponseTypes.DeferredChannelMessageWithSource
    | InteractionResponseTypes.DeferredUpdateMessage = InteractionResponseTypes.DeferredChannelMessageWithSource,
  isPrivate = false
) {
  const data: Partial<InteractionResponse["data"]> = {};
  if (isPrivate) data.flags = MessageFlags.Ephemeral;
  return await bot.rest.sendInteractionResponse(id, token, {
    type: type,
    data: {
      flags: isPrivate ? 64 : undefined,
    },
  });
}
