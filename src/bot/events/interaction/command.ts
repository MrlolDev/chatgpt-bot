import { Collection } from "discordeno";

import type { CustomInteraction } from "../../types/discordeno.js";
import type { CommandOptionValue } from "../../types/command.js";
import type { DiscordBot } from "../../index.js";

import { EmbedColor } from "../../utils/response.js";
import { COMMANDS } from "../../commands/mod.js";

/** Global command cool-downs */
const cooldowns: Collection<string, number> = new Collection();

export async function executeCommand(bot: DiscordBot, interaction: CustomInteraction) {
    if (!interaction.data) return;

    const command = COMMANDS.find(c => c.name === interaction.data?.name) ?? null;
    if (!command) return;

    const args: Record<string, CommandOptionValue> =
        parseCommandOptions(interaction);

    try {
        const response = await command.handler(bot, interaction, args);
        if (response) await interaction.reply(response);

    } catch (error) {
        await interaction.reply({
            embeds: {
                 title: "Uh-oh... 😬",
                 description: "It seems like an error has occured. *The developers have been notified.*",
                 color: EmbedColor.Red
            }
        });
    }
}

function parseCommandOptions(interaction: CustomInteraction) {
    const args: Record<string, CommandOptionValue> = {};

    if (interaction.data!.options) for (const option of interaction.data!.options) {
        const name = option.name;

        delete (option as any).name;
        delete (option as any).options;
        delete (option as any).focused;

        args[name] = option as CommandOptionValue;
    }

    return args;
}

function cooldown(interaction: CustomInteraction) {
    const existing = cooldowns.get(cooldownKey(interaction)) ?? null;
    if (!existing || existing < Date.now()) return null;

    return existing;
}

function setCooldown(interaction: CustomInteraction, duration: number) {
    cooldowns.set(cooldownKey(interaction), Date.now() + duration);
}

function cooldownKey(interaction: CustomInteraction) {
    return `${interaction.user.id}-${interaction.data?.name}`;
}