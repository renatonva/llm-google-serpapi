import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SerpAPIService } from '../services/serpApiService.ts';

export function createGoogleShoppingTool(serpAPIService: SerpAPIService) {
  return tool(
    async ({ query, minPrice, maxPrice, freeShippingOnly, onSaleOnly, limit }) => {
      const data = await serpAPIService.searchGoogleShopping({
        query,
        minPrice,
        maxPrice,
        freeShippingOnly,
        onSaleOnly,
        limit,
      });
      return JSON.stringify(data);
    },
    {
      name: 'google_shopping',
      description:
        'Search Google Shopping (Brazil, prices in BRL) to find the best prices for a product. ' +
        'Returns offers sorted from cheapest to most expensive, each with store, price, rating, delivery info and link. ' +
        'Use a specific query (brand + model + key spec, e.g. "Samsung Galaxy S24 128GB") to avoid cheap accessories ' +
        'polluting the results. Call this whenever the user wants to buy, compare prices or find the cheapest offer for a product.',
      schema: z.object({
        query: z
          .string()
          .min(2)
          .describe('Product to search for. Be specific: brand, model and main specs.'),
        minPrice: z
          .number()
          .positive()
          .optional()
          .describe('Minimum price in BRL. Useful to filter out accessories and parts.'),
        maxPrice: z.number().positive().optional().describe('Maximum price in BRL.'),
        freeShippingOnly: z
          .boolean()
          .optional()
          .describe('Only return offers with free shipping.'),
        onSaleOnly: z.boolean().optional().describe('Only return offers currently on sale.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe('Maximum number of offers to return (default 10).'),
      }),
    },
  );
}