// tools/googleMapsTool.ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SerpAPIService } from '../services/serpApiService.ts';

export function createGoogleMapsTool(serpAPIService: SerpAPIService) {
  return tool(
    async ({ query, latitude, longitude, zoom, limit }) => {
      if ((latitude === undefined) !== (longitude === undefined)) {
        throw new Error('latitude and longitude must be provided together.');
      }

      const data = await serpAPIService.searchGoogleMaps({
        query,
        latitude,
        longitude,
        zoom,
        limit,
      });
      return JSON.stringify(data);
    },
    {
      name: 'google_maps',
      description:
        'Search Google Maps to find places, businesses or specific addresses. ' +
        'Returns for each place: name, full address, phone, website, category, rating, number of reviews, ' +
        'price level, opening hours/open state, GPS coordinates, place_id and data_id. ' +
        'Use this whenever the user asks about a specific address, a business, "what is at this address", ' +
        'nearby places (restaurants, pharmacies, gas stations, etc.), opening hours, phone numbers or location. ' +
        'Do NOT use it for hotel prices/availability (use google_hotels) or flights. ' +
        'For a specific address, pass the full address as the query (street, number, city, state).',
      schema: z.object({
        query: z
          .string()
          .min(2)
          .describe(
            'What to search. Either a full address (e.g. "Av. Paulista, 1578, São Paulo - SP") ' +
              'or a category plus location (e.g. "farmácias 24h em Caeté, MG").',
          ),
        latitude: z
          .number()
          .min(-90)
          .max(90)
          .optional()
          .describe('Latitude to center the search. Set only together with longitude, and only if known.'),
        longitude: z
          .number()
          .min(-180)
          .max(180)
          .optional()
          .describe('Longitude to center the search. Set only together with latitude, and only if known.'),
        zoom: z
          .number()
          .int()
          .min(3)
          .max(21)
          .default(14)
          .describe('Map zoom when latitude/longitude are given (3 = country, 14 = neighborhood, 18 = street). Default 14.'),
        limit: z.number().int().min(1).max(15).default(5).describe('Maximum number of places to return (default 5).'),
      }),
    },
  );
}

export function createGoogleMapsPlaceDetailsTool(serpAPIService: SerpAPIService) {
  return tool(
    async ({ placeId }) => {
      const data = await serpAPIService.getGoogleMapsPlaceDetails(placeId);
      return JSON.stringify(data);
    },
    {
      name: 'google_maps_place_details',
      description:
        'Get detailed information about ONE place on Google Maps using its place_id ' +
        '(obtained from the google_maps tool). Use it only when the user wants more details ' +
        'about a place already found (full hours, description, etc.). Do NOT use it to search.',
      schema: z.object({
        placeId: z.string().min(5).describe('The place_id returned by the google_maps tool.'),
      }),
    },
  );
}

export function createGoogleMapsPhotosTool(serpAPIService: SerpAPIService) {
  return tool(
    async ({ dataId, categoryId, limit }) => {
      const data = await serpAPIService.getGoogleMapsPhotos({ dataId, categoryId, limit });
      return JSON.stringify(data);
    },
    {
      name: 'google_maps_photos',
      description:
        'Get photos of ONE place on Google Maps using its data_id (obtained from the google_maps tool). ' +
        'Returns image URLs and the available photo categories (e.g. food, interior, exterior). ' +
        'Use it only when the user asks to see photos/images of a place already found. ' +
        'Do NOT use it to search for places. To filter, call it first without categoryId, ' +
        'then again with an id from the returned categories if the user wants a specific type of photo.',
      schema: z.object({
        dataId: z.string().min(5).describe('The data_id returned by the google_maps tool.'),
        categoryId: z
          .string()
          .optional()
          .describe('Photo category id, taken from the "categories" of a previous google_maps_photos result. Set only if the user wants a specific type of photo.'),
        limit: z.number().int().min(1).max(20).default(6).describe('Maximum number of photos to return (default 6).'),
      }),
    },
  );
}