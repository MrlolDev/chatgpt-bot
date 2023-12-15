import {
	BigString,
	Bot,
	ButtonComponent,
	ButtonStyles,
	Collection,
	CreateMessageOptions,
	Message,
	MessageComponentTypes,
	delay,
} from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";
import { OptionResolver } from "../handlers/OptionResolver.js";
import { Environment } from "../../types/other.js";
import { env } from "../utils/db.js";
import { LOADING_INDICATORS } from "../../types/models/users.js";
import { CHAT_MODELS } from "../models/index.js";
import EventEmitter from "events";
import { addMessageToConversation, getConversation, newConversation } from "../utils/conversations.js";
import { getDefaultValues, getSettingsValue } from "../utils/settings.js";
import { chargePlan, requiredPremium } from "../utils/premium.js";

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
		user: 2 * 60 * 1000,
		voter: 90 * 1000,
		subscription: 45 * 1000,
	},
	interaction: async ({ interaction, options, env, premium }) => {
		const edit = async (message: CreateMessageOptions) =>
			await interaction
				.edit(message)
				.catch((...args) => ["chat interaction", interaction, ...args].forEach((x) => interaction.bot.logger.warn(x)));
		await buildInfo(interaction.bot, interaction.user.id, edit, env, interaction.guildId, options, premium);
	},
	message: async ({ message, bot, args, env, premium }) => {
		const parser = {
			getString: () => args.join(" "),
		} as unknown as OptionResolver;
		let previousMsg: Message | undefined;
		const edit = async (msg: CreateMessageOptions) => {
			//	console.log(previousMsg ? previousMsg.id : "no previous message");
			if (previousMsg?.id) {
				previousMsg = await bot.helpers.editMessage(previousMsg.channelId, previousMsg.id, msg).catch((...args) => {
					["chat message", previousMsg, ...args].forEach((x) => bot.logger.warn(x));
					return undefined;
				});
			} else {
				previousMsg = await bot.helpers.sendMessage(message.channelId, {
					...msg,
					messageReference: {
						failIfNotExists: false,
						messageId: message.id,
						guildId: message.guildId,
					},
					allowedMentions: {
						repliedUser: true,
						parse: [],
					},
				});
			}
		};
		await buildInfo(bot, message.author.id, edit, env, message.guildId, parser, premium);
	},
});

async function buildInfo(
	bot: Bot,
	userId: bigint,
	edit: (message: CreateMessageOptions) => void,
	env: Environment,
	guildId?: BigString,
	options?: OptionResolver,
	premium?: {
		type: "plan" | "subscription";
		location: "user" | "guild";
	} | null,
): Promise<void> {
	//const envrionment = await env(userId.toString(), guildId?.toString());

	const prompt: string = options?.getString("prompt") ?? "";
	const user = env.user;
	let setting = (await getSettingsValue(user, "chat:model")) as string;
	if (!setting) {
		setting = (await getDefaultValues("chat:model")) as string;
	}
	const modelName = setting;
	const model = CHAT_MODELS.find((x) => x.id === modelName);
	if (!model) {
		return await edit({
			content: "Model not found",
		});
	}
	if (model.premium && !premium) {
		return await edit(requiredPremium as CreateMessageOptions);
	}

	let conversation = await getConversation(userId.toString(), modelName);
	const history = conversation?.history ?? {
		messages: [],
	};
	const data: {
		messages: { role: string; content: string }[];
		max_tokens?: number;
		temperature?: number;
		model?: string;
	} = {
		max_tokens: premium ? 500 : 300,
		messages: [
			...history.messages,
			{
				role: "user",
				content: prompt,
			},
		],
	};
	if (modelName === "gemini") {
		data.model = "gemini-pro";
	}
	try {
		const event = await model.run(bot.api, data);
		if (conversation) {
			await addMessageToConversation(conversation, {
				role: "user",
				content: prompt,
			});
		} else {
			conversation = await newConversation(
				{
					role: "user",
					content: prompt,
				},
				userId.toString(),
				modelName,
			);
		}
		if (!event || !(event instanceof EventEmitter)) {
			return await edit({
				content: "An error occurred",
			});
		}
		let loadingIndicatorId: string | boolean | number | object = await getSettingsValue(user, "general:loadingIndicator");
		if (!loadingIndicatorId) {
			loadingIndicatorId = (await getDefaultValues("general:loadingIndicator")) as string;
		}
		const loadingIndicator = LOADING_INDICATORS[loadingIndicatorId as number];

		let lastUpdate = Date.now();
		let done = false;
		event.on("data", async (data) => {
			if (data.result === "") return;
			data.result = data.result.replaceAll("@everyone", "everyone").replaceAll("@here", "here");
			// make a regex to replace all mentions of users or roles
			data.result = data.result.replaceAll(/<&\d+>/g, "role").replaceAll(/<@\d+>/g, "user");
			if (!data.done) {
				if (lastUpdate + 1000 < Date.now() && !done) {
					// if last update was more than 1 second ago
					lastUpdate = Date.now();
					await edit({
						content: `${data.result}<${loadingIndicator.emoji.animated ? "a" : ""}:${loadingIndicator.emoji.name}:${
							loadingIndicator.emoji.id
						}>`,
					});
				}
			} else {
				done = true;
				if (conversation) {
					await addMessageToConversation(conversation, {
						role: "assistant",
						content: data.result,
					});
				}
				// if last update was less than 1 second ago, wait 1 second
				if (lastUpdate + 1000 > Date.now()) await delay(1000);
				await chargePlan(data.cost, env, "chat", modelName);

				await edit({
					content: `${data.result}`,
					components: [
						{
							type: MessageComponentTypes.ActionRow,
							components: [
								{
									type: MessageComponentTypes.Button,
									label: model.name,
									customId: "settings_open",
									disabled: false,
									emoji: {
										name: model.emoji.name,
										id: BigInt(model.emoji.id),
									},
									style: ButtonStyles.Secondary,
								},
							],
						},
					],
				});
			}
		});
	} catch (e) {
		console.log(e);
		return await edit({
			content: "An error occurred",
		});
	}
}
