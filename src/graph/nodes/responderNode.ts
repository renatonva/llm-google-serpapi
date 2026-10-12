import { AIMessage } from '@langchain/core/messages';
import { OpenRouterService } from '../../services/openRouterService.ts';
import { getResponderSystemPrompt, getResponderUserPrompt } from '../../prompts/v1/shoppingResponder.ts';
import type { GraphState } from '../state.ts';

export function createResponderNode(openRouterService: OpenRouterService) {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
        console.log('💬 Responder processing...');
        try {
            const userQuestion = state.question!;

            // useTools: false -> o responder só redige a resposta, não faz novas buscas.
            const { data } = await openRouterService.generateStructured(
                getResponderSystemPrompt(),
                getResponderUserPrompt(userQuestion, state.trendsData ?? ''),
                undefined,
                { useTools: false },
            );

            const content = data as string;

            return { messages: [new AIMessage(content)] };

        } catch (error) {
            console.error('Responder error:', error);
            return { messages: [new AIMessage('Sorry, something went wrong while generating the response.')] };
        }

    };
}