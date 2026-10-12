import { ChatOpenAI } from '@langchain/openai';
import { config, type ModelConfig } from '../config.ts';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { createAgent, providerStrategy } from 'langchain';
import { getMCPTools } from './mcpService.ts';
import { z } from 'zod/v3';

type GenerateOptions = {
    // Por padrão: usa tools quando NÃO há schema (comportamento anterior).
    // Passe false para uma chamada que só deve redigir texto (ex.: responder).
    useTools?: boolean;
};

export class OpenRouterService {
    private config: ModelConfig;
    private llmClient: ChatOpenAI;
    private tools: any[];

    constructor(configOverride?: ModelConfig) {
        this.config = configOverride ?? config;
        this.llmClient = this.#createChatModel(this.config.models[0]);
        this.tools = [];
    }

    #createChatModel(modelName: string): ChatOpenAI {
        return new ChatOpenAI({
            apiKey: this.config.apiKey,
            modelName: modelName,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            configuration: {
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    'HTTP-Referer': this.config.httpReferer,
                    'X-Title': this.config.xTitle,
                },
            },
            modelKwargs: {
                models: this.config.models,
                provider: this.config.provider,
            },
        });
    }

    // O conteúdo de uma ToolMessage pode ser string ou lista de blocos ({ type: 'text', text }).
    #contentToText(content: unknown): string {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .map((block: any) => (typeof block === 'string' ? block : block?.text ?? JSON.stringify(block)))
                .join('\n');
        }
        return JSON.stringify(content);
    }

    async generateStructured<T>(
        systemPrompt: string,
        userPrompt: string,
        schema?: z.ZodSchema<T>,
        options?: GenerateOptions,
    ): Promise<{ data?: T | string; toolOutputs?: string[] }> {
        const useTools = options?.useTools ?? !schema;

        if (useTools && !this.tools.length) {
            this.tools = await getMCPTools();
        }

        const agentConfig = schema ?
            {
                responseFormat: providerStrategy(schema),
                tools: []
            }
            : { tools: useTools ? this.tools : [] };

        const agent = createAgent({
            ...agentConfig,
            model: this.llmClient,
        });

        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(userPrompt),
        ];

        const data = await agent.invoke({ messages });
        console.log('✅ LLM Response:', JSON.stringify(data, null, 2));

        // Resultados brutos das tools (ex.: JSON da SerpApi), sem o resumo do modelo.
        const toolOutputs = (data.messages as BaseMessage[])
            .filter((message) => message.type === 'tool')
            .map((message) => this.#contentToText(message.content));

        return {
            data: (schema ?
                ((data as any).structuredResponse as T) :
                data.messages.at(-1)?.text
            ),
            toolOutputs,
        };
    }
}