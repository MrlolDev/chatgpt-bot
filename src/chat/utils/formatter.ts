interface MessageFormatter {
    /* Identifier of the formatter */
    name: string;

    /* Function to execute to get this formatter's result */
    execute: (content: string) => string | null;
}

const MARKDOWN_LINK_REGEXP: RegExp = /\[(.*?)\]\((.*?)\)/g

/* Formatters to execute */
const formatters: MessageFormatter[] = [
    {
        name: "Fix broken code blocks",
        execute: content => content.split("```").length % 2 === 0 ? `${content}\n\`\`\`` : null
    },

    {
        name: "Style Markdown links correctly",
        execute: content => content.replaceAll(MARKDOWN_LINK_REGEXP, "**$1** (*<$2>*)")
    }
]

/**
 * Apply all formatting options to the specified string, e.g. cleaning up or adding formatting.
 * @param content Content to fromat
 * 
 * @throws An error, if something went wrong
 * @returns Formatted string
 */
export const format = (content: string): string => {
    let final: string = content;

    for (const formatter of formatters) {
        try {
            const output: string | null = formatter.execute(final);
            if (output !== null) final = output;
        } catch (error) {
            throw new Error(`Failed to format content using formatter ${formatter.name} -> ${(error as Error).toString()}`);
        }
    }

    return final;
} 