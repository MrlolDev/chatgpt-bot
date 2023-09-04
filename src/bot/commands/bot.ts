import type { Conversation } from "../types/conversation.js";
import {
  ButtonComponent,
  ButtonStyles,
  MessageComponentTypes,
} from "discordeno";

import { createCommand } from "../helpers/command.js";
import { ResponseError } from "../error/response.js";
import { EmbedColor } from "../utils/response.js";

import { BRANDING_COLOR, SUPPORT_INVITE } from "../../config.js";

const partners = [
  {
    emoji: "<:trident:1128664558425362522>",
    name: "TridentNodes",
    url: "https://link.turing.sh/tridentnodes",
    description: "Reliable, powerful, affordable hosting",
  },
  {
    emoji: "<:runpod:1121108621170839592>",
    name: "RunPod",
    url: "https://link.turing.sh/runpod",
    description:
      "Providing various GPU models for the bot, like image recognition",
  },
];
const repo = "TuringAI-Team/chatgpt-discord-bot";

async function getLastRelease(): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/releases/latest`
  );
  const { tag_name } = await response.json();
  return tag_name;
}

export default createCommand({
  name: "bot",
  description: "View information & statistics about the bot",

  handler: async ({ bot, env, interaction }) => {
    let stats = await bot.api.other.stats();
    let startDate = new Date("Thu, 15 Dec 2022 18:27:08 UTC");
    let msStart = startDate.getTime();

    const buttons = [
      {
        type: MessageComponentTypes.Button,
        label: "Add me to your server",
        url: "https://discord.com/oauth2/authorize?client_id=1053015370115588147&permissions=281357371712&scope=bot%20applications.commands",
        style: ButtonStyles.Link,
      },
      {
        type: MessageComponentTypes.Button,
        label: "Support Server",
        url: `https://${SUPPORT_INVITE}`,
        style: ButtonStyles.Link,
      },
      {
        type: MessageComponentTypes.Button,
        emoji: {
          name: "<:github:1097828013871222865>",
        },
        label: "GitHub",
        url: `https://github.com/${repo}`,
      },
    ];

    return {
      embeds: [
        {
          title: "Bot Statistics",
          fields: [
            {
              name: "Servers 🖥️",
              value: `${stats.guilds}`,
            },
            {
              name: "Version 🔃",
              value: `[${getLastRelease()}](https://github.com/${repo}/releases/latest)`,
            },
          ],
          color: BRANDING_COLOR,
          timestamp: msStart,
        },
        {
          color: BRANDING_COLOR,
          title: "Partners 🤝",
          description: partners
            .map(
              (p) =>
                `${p.emoji ? `${p.emoji} ` : ""}[**${p.name}**](${p.url})${
                  p.description ? ` — *${p.description}*` : ""
                }`
            )
            .join("\n"),
        },
      ],
      components: [
        {
          type: MessageComponentTypes.ActionRow,
          components: buttons as [ButtonComponent],
        },
      ],

      ephemeral: false,
    };
  },
});
