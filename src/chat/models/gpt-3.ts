import { OpenAICompletionsData, OpenAIPartialCompletionsJSON } from "../../openai/types/completions.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../../error/gpt/generation.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient, PromptData } from "../client.js";

export class GPT3Model extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "GPT-3",
            type: ModelType.OpenAICompletion,

            capabilities: [ ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    /**
     * Make the actual call to the OpenAI API, to generate a response for the given prompt.
     * This always concatenates the history & starting prompt.
     * 
     * @param options Generation options
     * @returns Generated response
     */
    private async generate(options: ModelGenerationOptions, progress?: (response: OpenAIPartialCompletionsJSON) => Promise<void> | void): Promise<OpenAICompletionsData | null> {
        const prompt: PromptData = await this.client.buildPrompt(options);

        const data: OpenAICompletionsData = await this.client.session.ai.complete({
            model: options.settings.options.settings.model ?? "text-davinci-003",
            stream: options.partial,
            stop: "User:",

            user: options.conversation.userIdentifier,

            temperature: options.settings.options.settings.temperature ?? 0.5,
            max_tokens: isFinite(prompt.max) ? prompt.max : undefined,
            prompt: prompt.prompt
        }, progress);

        if (data.response.text.trim().length === 0) return null;

        return {
            ...data,

            usage: {
                completion_tokens: getPromptLength(data.response.text),
                prompt_tokens: getPromptLength(prompt.prompt),
                total_tokens: 0
            }
        };
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const data: OpenAICompletionsData | null = await this.generate(options, response => options.progress({ text: response.choices[0].text }));
        if (data === null) throw new GPTGenerationError({ type: GPTGenerationErrorType.Empty });

        return {
            text: data.response.text,

            raw: {
                finishReason: data.response.finish_reason ? data.response.finish_reason === "length" || data.response.finish_reason === "max_tokens" ? "maxLength" : "stop" : undefined,
               
                usage: {
                    completion: data.usage.completion_tokens,
                    prompt: data.usage.prompt_tokens
                }
            }
        };
    }
}