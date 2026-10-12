import { OpenRouterService } from '../../services/openRouterService.ts';
import type { GraphState } from '../state.ts';
import { getKeywordsSystemPrompt } from '../../prompts/v1/keywords.ts';

// Evita estourar o contexto do responder com JSONs muito grandes (ex.: voos).
const MAX_SEARCH_DATA_CHARS = 30_000;

// Via LangGraph Studio / API (langgraph dev), o content da mensagem chega como lista de
// blocos ([{ type: 'text', text: '...' }]). Via index.ts chega como string.
// Aqui normalizamos os dois casos para string.
const messageContentToText = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((block: any) => (typeof block === 'string' ? block : block?.text ?? ''))
            .join(' ')
            .trim();
    }
    return String(content ?? '');
};

export function createResearcherNode(openRouterService: OpenRouterService) {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
        console.log('🔍 Researcher processing...');
        const userQuestion = messageContentToText(state.messages.at(-1)!.content);
        try {

            const { data, toolOutputs } = await openRouterService.generateStructured(
                getKeywordsSystemPrompt(),
                userQuestion,
            );

            // Se a tool foi chamada, repassa o JSON bruto da SerpApi.
            // Se não (ex.: faltou origem/datas), repassa o texto do modelo (pergunta de esclarecimento).
            const searchData = toolOutputs?.length
                ? toolOutputs.join('\n\n')
                : (typeof data === 'string' ? data : JSON.stringify(data, null, 2));

            console.log(
                toolOutputs?.length
                    ? '📊 Search data fetched via tool call'
                    : '💬 No tool call: passing the model text forward',
            );

            return {
                trendsData: searchData.slice(0, MAX_SEARCH_DATA_CHARS),
                question: userQuestion,
            };

        } catch (error) {
            console.error('Researcher error:', error);
            return {
                trendsData: 'Sorry, something went wrong while fetching search data.',
                question: userQuestion,
            };
        }
    };
}