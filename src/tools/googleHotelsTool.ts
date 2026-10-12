import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SerpAPIService } from '../services/serpApiService.ts';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function createGoogleHotelsTool(serpAPIService: SerpAPIService) {
  return tool(
    async ({
      query,
      checkInDate,
      checkOutDate,
      adults,
      minPrice,
      maxPrice,
      minRating,
      freeCancellationOnly,
      limit,
    }) => {
      if (checkOutDate <= checkInDate) {
        throw new Error('checkOutDate must be after checkInDate.');
      }

      const data = await serpAPIService.searchGoogleHotels({
        query,
        checkInDate,
        checkOutDate,
        adults,
        minPrice,
        maxPrice,
        minRating,
        freeCancellationOnly,
        limit,
      });
      return JSON.stringify(data);
    },
    {
      name: 'google_hotels',
      description:
        'Search Google Hotels (prices in BRL) to find the cheapest places to stay in a destination. ' +
        'Returns properties sorted from cheapest to most expensive per night, each with nightly rate, total rate for the stay, ' +
        'rating, number of reviews, hotel class and link. ' +
        'Use this whenever the user asks about hotels, hospedagem, pousadas or where to stay. ' +
        'Do NOT use it for flights or products. ' +
        'Requires destination, check-in date and check-out date.',
      schema: z.object({
        query: z
          .string()
          .min(2)
          .describe('Destination (city or neighborhood, e.g. "Porto de Galinhas") or a specific hotel name.'),
        checkInDate: z
          .string()
          .regex(DATE_REGEX, 'Must be YYYY-MM-DD')
          .describe('Check-in date, format YYYY-MM-DD. Must be today or in the future.'),
        checkOutDate: z
          .string()
          .regex(DATE_REGEX, 'Must be YYYY-MM-DD')
          .describe('Check-out date, format YYYY-MM-DD. Must be after the check-in date.'),
        adults: z.number().int().min(1).max(10).default(2).describe('Number of adults (default 2).'),
        minPrice: z.number().positive().optional().describe('Minimum nightly price in BRL. Set only if the user asked.'),
        maxPrice: z.number().positive().optional().describe('Maximum nightly price in BRL. Set only if the user gave a budget.'),
        minRating: z
          .number()
          .min(3.5)
          .max(4.5)
          .optional()
          .describe('Minimum guest rating: 3.5, 4.0 or 4.5. Set only if the user asked for well-rated places.'),
        freeCancellationOnly: z
          .boolean()
          .optional()
          .describe('Only properties with free cancellation. Set only if the user asked.'),
        limit: z.number().int().min(1).max(15).default(8).describe('Maximum number of properties to return (default 8).'),
      }),
    },
  );
}