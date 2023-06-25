import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { DatabaseGuild } from "../../db/schemas/guild.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export default class GuildCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("guild")
				.setDescription("View information about a guild")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("ID or name of the guild to view")
					.setRequired(true)
				)
        , { restriction: [ "moderator" ] });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* ID of the guild */
		const id: string = interaction.options.getString("id", true);
		const target = await Utils.findGuild(this.bot, id);
		
		if (target === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified guild does not exist 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* Get the database entry of the guild, if applicable. */
		const db: DatabaseGuild | null = await this.bot.db.users.getGuild(target.id);

		if (db === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified guild hasn't interacted with the bot 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		return await this.bot.moderation.buildGuildOverview(target, db);
    }
}