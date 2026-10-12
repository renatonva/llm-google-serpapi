import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SerpAPIService } from '../services/serpApiService.ts';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function createGoogleFlightsTool(serpAPIService: SerpAPIService) {
  return tool(
    async ({
      departureId,
      arrivalId,
      outboundDate,
      returnDate,
      adults,
      travelClass,
      nonstopOnly,
      maxPrice,
      limit,
    }) => {
      if (returnDate && returnDate < outboundDate) {
        throw new Error('returnDate must be on or after outboundDate.');
      }

      const data = await serpAPIService.searchGoogleFlights({
        departureId,
        arrivalId,
        outboundDate,
        returnDate,
        adults,
        travelClass,
        nonstopOnly,
        maxPrice,
        limit,
      });
      return JSON.stringify(data);
    },
    {
      name: 'google_flights',
      description:
        'Search Google Flights (prices in BRL) to find the cheapest flights between two airports. ' +
        'Returns options sorted from cheapest to most expensive, each with price, airlines, stops, total duration, ' +
        'segments (flight numbers, airports, times) and layovers, plus price insights when available. ' +
        'Use this whenever the user asks about flights, airfare or passagens aéreas. ' +
        'Do NOT use it for hotels or products. ' +
        'Requires origin, destination and outbound date; add a return date for a round trip, omit it for one way.',
      schema: z.object({
        departureId: z
          .string()
          .regex(/^[A-Z]{3}$/, 'Must be a 3-letter uppercase IATA airport code, e.g. CNF')
          .describe(
            'Departure airport IATA code (3 uppercase letters). Examples: CNF Belo Horizonte-Confins, GRU São Paulo-Guarulhos, ' +
              'CGH São Paulo-Congonhas, GIG Rio-Galeão, SDU Rio-Santos Dumont, BSB Brasília, SSA Salvador, REC Recife, ' +
              'FOR Fortaleza, POA Porto Alegre, CWB Curitiba.',
          ),
        arrivalId: z
          .string()
          .regex(/^[A-Z]{3}$/, 'Must be a 3-letter uppercase IATA airport code, e.g. GRU')
          .describe('Arrival airport IATA code (3 uppercase letters).'),
        outboundDate: z
          .string()
          .regex(DATE_REGEX, 'Must be YYYY-MM-DD')
          .describe('Outbound (departure) date, format YYYY-MM-DD. Must be today or in the future.'),
        returnDate: z
          .string()
          .regex(DATE_REGEX, 'Must be YYYY-MM-DD')
          .optional()
          .describe('Return date, format YYYY-MM-DD. Provide for round trip; omit for one way.'),
        adults: z.number().int().min(1).max(9).default(1).describe('Number of adult passengers (default 1).'),
        travelClass: z
          .enum(['economy', 'premium_economy', 'business', 'first'])
          .default('economy')
          .describe('Cabin class (default economy).'),
        nonstopOnly: z.boolean().optional().describe('Only direct flights without stops. Set only if the user asked.'),
        maxPrice: z.number().positive().optional().describe('Maximum ticket price in BRL. Set only if the user gave a budget.'),
        limit: z.number().int().min(1).max(10).default(5).describe('Maximum number of flight options to return (default 5).'),
      }),
    },
  );
}