import { BigString, Bot, ButtonComponent, ButtonStyles, CreateMessageOptions, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";
import { OptionResolver } from "../handlers/OptionResolver.js";
import { Environment } from "../../types/other.js";
import { env } from "../utils/db.js";

export default createCommand({
	body: {
		name: "chat",
		description: "Chat with the bot",
		options: [
			{
				type: "String",
				name: "prompt",
				description: "The prompt that will be used for the text generation",
				max_length: 1000,
				required: true,
			},
		],
	},
	cooldown: {
		user: 30 * 1000,
		voter: 2 * 60 * 1000,
		subscription: 60 * 1000,
	},
	interaction: async ({ interaction, options, env }) => {
		await interaction.edit({ ...(await buildInfo(interaction.bot, interaction.user.id, interaction.guildId, options)) });
	},
	message: async ({ message, bot, args, env }) => {
		const parser = { getString: () => args.join(" ") } as unknown as OptionResolver;
		await bot.helpers.sendMessage(message.channelId, {
			...(await buildInfo(bot, message.author.id, message.guildId, parser)),
			messageReference: {
				failIfNotExists: false,
				messageId: message.id,
				guildId: message.guildId,
			},
		});
	},
});

async function buildInfo(bot: Bot, userId: bigint, guildId?: BigString, options?: OptionResolver): Promise<CreateMessageOptions> {
	const envrionment = await env(userId.toString(), guildId?.toString());

	const option = options?.getString("prompt");
	return {
		embeds: [
			{
				title: "The bot is under maintenance",
				description: `The bot is currently under maintenance, please try again later. Join our support server for more information.\n\n**How can I help?**\n- Be patient.\n- You can donate to the project in order to be able to continue providing this service for free`,
				color: config.brand.color,
			},
		],
		components: [
			{
				type: MessageComponentTypes.ActionRow,
				components: [
					{
						type: MessageComponentTypes.Button,
						label: "Support Server",
						url: `https://discord.gg/${config.brand.invite}`,
						style: ButtonStyles.Link,
					},
					{
						// KO-FI
						type: MessageComponentTypes.Button,
						label: "Donate to the project",
						emoji: {
							id: 1162684912206360627n,
							name: "kofi",
						},
						url: "https://ko-fi.com/mrloldev",
						style: ButtonStyles.Link,
					},
				],
			},
		],
	};
}
