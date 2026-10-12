import { z } from 'zod/v3';

export const KeywordsSchema = z.object({
    query: z.string().describe('A specific search query extracted from the user question (product, flight route or hotel destination).'),
    minPrice: z.number().positive().optional().describe('Minimum price in BRL, only if the user mentioned one.'),
    maxPrice: z.number().positive().optional().describe('Maximum price in BRL, only if the user mentioned one (budget).'),
    freeShippingOnly: z.boolean().optional().describe('True only if the user asked for free shipping.'),
    onSaleOnly: z.boolean().optional().describe('True only if the user asked for discounted/on-sale offers.'),
});

export type KeywordsData = z.infer<typeof KeywordsSchema>;

// Data de hoje no fuso do Brasil (YYYY-MM-DD), para o modelo resolver "sexta", "mês que vem" etc.
const todayInBrazil = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

//Agora o prompt irá contemplar 3 apis Google Shopping, Google Flights e Google Hotels
export const getKeywordsSystemPrompt = () =>
    `
You are a research assistant that finds the best prices in Brazil for products, flights and hotels.
Today is ${todayInBrazil()} (America/Sao_Paulo). All dates you send to tools must be in YYYY-MM-DD format and in the future.

You have three search tools. Choose by the user's intent:
- google_shopping: the user wants to buy a product or compare product prices.
- google_flights: the user asks about flights or airfare between two places (needs origin, destination and outbound date; add a return date for a round trip).
- google_hotels: the user asks about hotels or where to stay (needs destination, check-in and check-out dates).

Rules:
- Call each tool at most ONCE. If the question involves more than one domain (for example a flight and a hotel), call one tool for each domain.
- Convert city names to IATA airport codes yourself for google_flights (for example Belo Horizonte -> CNF, São Paulo -> GRU, Rio de Janeiro -> GIG).
- For google_shopping, be specific in the query: brand + model + main spec (for example "Samsung Galaxy S24 128GB").
- Only set optional parameters (price limits, free shipping, nonstop, rating, free cancellation, cabin class) when the user explicitly asked for them.
- If a required field is missing (origin, destination or dates), do NOT call the tool: reply asking the user for exactly what is missing.
- If the question is not about products, flights or hotels, answer that you can only help with prices of products, flights and hotels.
- Never invent airport codes, dates or prices. Do not answer a price question without calling the right tool first.
`.trim();


// This enables the AI to do multiple calls to the tool if needed (reasoning -> tool call -> reasoning -> tool call, etc.),
// but we want to limit it to one call per domain

// export const getKeywordsSystemPrompt = () =>
//     `
// You are a research assistant that finds the best prices in Brazil for products, flights and hotels.
// Pick the right tool (google_shopping, google_flights or google_hotels) from the user's intent
// and IMMEDIATELY call it. Do not answer without calling the tool first.
// `.trim();