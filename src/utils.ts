import { ChainType } from '@/chainFactory';
import {
  ANTHROPIC,
  AZURE_MODELS,
  AZURE_OPENAI,
  CLAUDE_MODELS,
  DEFAULT_SETTINGS,
  DISPLAY_NAME_TO_MODEL,
  OPENAI,
  OPENAI_MODELS,
  USER_SENDER,
} from '@/constants';
import { CopilotSettings } from '@/main';
import { ChatMessage } from '@/sharedState';
import {
  BaseChain,
  LLMChain,
  RetrievalQAChain
} from "langchain/chains";
import moment from 'moment';
import { CachedMetadata, Notice, TFile, TFolder } from 'obsidian';

export function notifyUser(message: string, logError = true) {
	new Notice(message)
	if (logError) {
		console.error(message)
	}
}

export const stringToChainType = (chain: string): ChainType => {
  switch(chain) {
    case 'llm_chain':
      return ChainType.LLM_CHAIN;
    case 'retrieval_qa':
      return ChainType.RETRIEVAL_QA_CHAIN;
    default:
      throw new Error(`Unknown chain type: ${chain}`);
  }
}

export const isLLMChain = (chain: BaseChain): chain is LLMChain => {
  return (chain as any).llm !== undefined;
}

export const isRetrievalQAChain = (chain: BaseChain): chain is RetrievalQAChain => {
  return (chain as any).retriever !== undefined;
}

export const isSupportedChain = (chain: BaseChain): chain is BaseChain => {
    return isLLMChain(chain) || isRetrievalQAChain(chain);
  }

export const getModelName = (modelDisplayName: string): string => {
  return DISPLAY_NAME_TO_MODEL[modelDisplayName];
}

export const getModelVendorMap = (): Record<string, string> => {
  const model_to_vendor: Record<string, string> = {};

  for (const model of OPENAI_MODELS) {
    model_to_vendor[model] = OPENAI;
  }

  for (const model of AZURE_MODELS) {
    model_to_vendor[model] = AZURE_OPENAI;
  }

  for (const model of CLAUDE_MODELS) {
    model_to_vendor[model] = ANTHROPIC;
  }
  return model_to_vendor;
}

// Returns the last N messages from the chat history,
// last one being the newest ai message
export const getChatContext = (chatHistory: ChatMessage[], contextSize: number) => {
  if (chatHistory.length === 0) {
    return [];
  }
  const lastAiMessageIndex = chatHistory.slice().reverse().findIndex(msg => msg.sender !== USER_SENDER);
  if (lastAiMessageIndex === -1) {
    // No ai messages found, return an empty array
    return [];
  }

  const lastIndex = chatHistory.length - 1 - lastAiMessageIndex;
  const startIndex = Math.max(0, lastIndex - contextSize + 1);
  return chatHistory.slice(startIndex, lastIndex + 1);
};

export const formatDateTime = (now: Date, timezone: 'local' | 'utc' = 'local') => {
  const formattedDateTime = moment(now);

  if (timezone === 'utc') {
    formattedDateTime.utc();
  }

  return formattedDateTime.format('YYYY_MM_DD-HH_mm_ss');
};

export async function getFileContent(file: TFile): Promise<string | null> {
  if (file.extension != "md") return null;
  return await this.app.vault.read(file);
}

export async function getCombinedFolderContent(folder: TFolder): Promise<string | null> {
	const children = folder.children

	if (children.length === 0) return null;

	const contents = await Promise.all(children.map(async (child) => {
		if (child instanceof TFile) {
            const content = await getFileContent(child);
            if (content === null) {
              return null;
            } else {
              return `# ${child.name}\n\n${content}`;
            }
        } else if (child instanceof TFolder) {
			return await getCombinedFolderContent(child);
		} else {
			return null
		}
	}))

	return contents.filter((content) => content!== null).join('\n\n')
}

export function getFileName(file: TFile): string {
  return file.basename;
}

export function getFolderName(folder: TFolder): string {
  return folder.name;
}
export function getFrontmatterTags(fileCache: CachedMetadata): string[] {
	const frontmatter = fileCache.frontmatter;
	if (!frontmatter) return [];

	// You can have both a 'tag' and 'tags' key in frontmatter.
	const frontMatterValues = Object.entries(frontmatter);
	if (!frontMatterValues.length) return [];

	const tagPairs = frontMatterValues.filter(([key, value]) => {
		const lowercaseKey = key.toLowerCase();

		// In Obsidian, these are synonymous.
		return lowercaseKey === "tags" || lowercaseKey === "tag";
	});

	if (!tagPairs) return [];

	const tags = tagPairs
		.flatMap(([key, value]) => {
			if (typeof value === "string") {
				// separator can either be comma or space separated
				return value.split(/,|\s+/).map((v) => v.trim());
			} else if (Array.isArray(value)) {
				return value as string[];
			}
		})
		.filter((v) => !!v) as string[]; // fair to cast after filtering out falsy values

	return tags;
}

export function getFileTags(file: TFile): string[] {
	const fileCache = app.metadataCache.getFileCache(file);
	if (!fileCache) return [];

	const tagsInFile: string[] = [];
	if (fileCache.frontmatter) {
		tagsInFile.push(...getFrontmatterTags(fileCache));
	}

	if (fileCache.tags && Array.isArray(fileCache.tags)) {
		tagsInFile.push(...fileCache.tags.map((v) => v.tag.replace(/^#/, "")));
	}

	return tagsInFile;
}

export function getMarkdownFilesWithTag(tag: string): TFile[] {
	const targetTag = tag.replace(/^#/, "");

	return app.vault.getMarkdownFiles().filter((f) => {
		const fileTags = getFileTags(f);

		return fileTags.includes(targetTag);
	});
}

export function sanitizeSettings(settings: CopilotSettings): CopilotSettings {
  const sanitizedSettings: CopilotSettings = { ...settings };

  // Stuff in settings are string even when the interface has number type!
  const temperature = Number(settings.temperature);
  sanitizedSettings.temperature = isNaN(temperature)
    ? DEFAULT_SETTINGS.temperature
    : temperature;

  const maxTokens = Number(settings.maxTokens);
  sanitizedSettings.maxTokens = isNaN(maxTokens)
    ? DEFAULT_SETTINGS.maxTokens
    : maxTokens;

  const contextTurns = Number(settings.contextTurns);
  sanitizedSettings.contextTurns = isNaN(contextTurns)
    ? DEFAULT_SETTINGS.contextTurns
    : contextTurns;

  return sanitizedSettings;
}

// Basic prompts
// Note that GPT4 is much better at following instructions than GPT3.5!
export function useNoteAsContextPrompt(
  noteName: string,
  noteContent: string | null,
): string {
  return `Please read the note below and be ready to answer questions about it. `
    + `If there's no information about a certain topic, just say the note `
    + `does not mention it. `
    + `The content of the note is between "/***/":\n\n/***/\n\n${noteContent}\n\n/***/\n\n`
    + `Please reply with the following word for word:`
    + `"OK I've read this note titled [[ ${noteName} ]]. `
    + `Feel free to ask related questions, such as 'give me a summary of this note in bullet points', 'what key questions does it answer', etc. "\n`
}

export function fixGrammarSpellingSelectionPrompt(selectedText: string): string {
  return `Please fix the grammar and spelling of the following text and return it without any other changes:\n\n`
    + `${selectedText}`;
}

export function summarizePrompt(selectedText: string): string {
  return `Please summarize the following text into bullet points and return it without any other changes. Output in the same language as the source, do not output English if it is not English:\n\n`
    + `${selectedText}`;
}

export function tocPrompt(selectedText: string): string {
  return `Please generate a table of contents for the following text and return it without any other changes. Output in the same language as the source, do not output English if it is not English:\n\n`
    + `${selectedText}`;
}

export function glossaryPrompt(selectedText: string): string {
  return `Please generate a glossary for the following text and return it without any other changes. Output in the same language as the source, do not output English if it is not English:\n\n`
    + `${selectedText}`;
}

export function simplifyPrompt(selectedText: string): string {
  return `Please simplify the following text so that a 6th-grader can understand. Output in the same language as the source, do not output English if it is not English:\n\n`
    + `${selectedText}`;
}

export function emojifyPrompt(selectedText: string): string {
  return `Please insert emojis to the following content without changing the text.`
    + `Insert at as many places as possible, but don't have any 2 emojis together. The original text must be returned.\n`
    + `Content: ${selectedText}`;
}

export function removeUrlsFromSelectionPrompt(selectedText: string): string {
  return `Please remove all URLs from the following text and return it without any other changes:\n\n`
    + `${selectedText}`;
}

export function rewriteTweetSelectionPrompt(selectedText: string): string {
  return `Please rewrite the following content to under 280 characters using simple sentences. Output in the same language as the source, do not output English if it is not English. Please follow the instruction strictly. Content:\n
    + ${selectedText}`
}

export function rewriteTweetThreadSelectionPrompt(selectedText: string): string {
  return `Please follow the instructions closely step by step and rewrite the content to a thread. `
    + `1. Each paragraph must be under 240 characters. `
    + `2. The starting line is \`THREAD START\n\`, and the ending line is \`\nTHREAD END\`. `
    + `3. You must use \`\n\n---\n\n\` to separate each paragraph! Then return it without any other changes. `
    + `4. Make it as engaging as possible.`
    + `5. Output in the same language as the source, do not output English if it is not English.\n The original content:\n\n`
    + `${selectedText}`;
}

export function rewriteShorterSelectionPrompt(selectedText: string): string {
  return `Please rewrite the following text to make it half as long while keeping the meaning as much as possible. Output in the same language as the source, do not output English if it is not English:\n`
    + `${selectedText}`;
}

export function rewriteLongerSelectionPrompt(selectedText: string): string {
  return `Please rewrite the following text to make it twice as long while keeping the meaning as much as possible. Output in the same language as the source, do not output English if it is not English:\n`
    + `${selectedText}`;
}

export function eli5SelectionPrompt(selectedText: string): string {
  return `Please explain the following text like I'm 5 years old. Output in the same language as the source, do not output English if it is not English:\n\n`
    + `${selectedText}`;
}

export function rewritePressReleaseSelectionPrompt(selectedText: string): string {
  return `Please rewrite the following text to make it sound like a press release. Output in the same language as the source, do not output English if it is not English:\n\n`
    + `${selectedText}`;
}

export function createTranslateSelectionPrompt(language?: string) {
  return (selectedText: string): string => {
    return `Please translate the following text to ${language}:\n\n` + `${selectedText}`;
  };
}

export function createChangeToneSelectionPrompt(tone?: string) {
  return (selectedText: string): string => {
    return `Please change the tone of the following text to ${tone}. Output in the same language as the source, do not output English if it is not English:\n\n` + `${selectedText}`;
  };
}

export function fillInSelectionForCustomPrompt(prompt?: string) {
  return (selectedText: string): string => {
    if (!prompt) {
      return selectedText;
    }
    return prompt.replace('{}', selectedText);
  };
}
