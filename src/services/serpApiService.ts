import { getJson } from 'serpapi';
import type { SerpAPIConfig } from '../config.ts';
import { risingTrendFixture } from '../../data/trendingData.ts';
import { shoppingFixture } from '../../data/shoppingData.ts';

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export type KeywordTrend = {
  keyword: string;
  searchVolume: number;
  interestOverTime: number;
  trend: 'rising' | 'stable' | 'declining';
};

export type RelatedQuery = {
  query: string;
  value: number;
};

export type RisingTopic = {
  topic: string;
  growth: number;
};

export type TrendingData = {
  keywords: KeywordTrend[];
  relatedQueries: RelatedQuery[];
  risingTopics: RisingTopic[];
  timestamp: string;
};

// ---------------------------------------------------------------------------
// Shopping
// ---------------------------------------------------------------------------

export type ShoppingSearchParams = {
  query: string;
  minPrice?: number;
  maxPrice?: number;
  freeShippingOnly?: boolean;
  onSaleOnly?: boolean;
  limit?: number;
};

export type ShoppingOffer = {
  title: string;
  store: string;
  price: string;
  priceValue: number;
  oldPrice?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  tag?: string;
  link: string;
  thumbnail?: string;
};

export type ShoppingSearchResult = {
  query: string;
  total: number;
  cheapest: ShoppingOffer | null;
  offers: ShoppingOffer[];
  timestamp: string;
};

// ---------------------------------------------------------------------------
// Flights
// ---------------------------------------------------------------------------

export type TravelClass = 'economy' | 'premium_economy' | 'business' | 'first';

export type FlightSearchParams = {
  departureId: string; // IATA, ex.: CNF
  arrivalId: string; // IATA, ex.: GRU
  outboundDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD (sem isso = só ida)
  adults?: number;
  travelClass?: TravelClass;
  nonstopOnly?: boolean;
  maxPrice?: number;
  limit?: number;
};

export type FlightSegment = {
  airline: string;
  flightNumber: string;
  from: string;
  departureTime: string;
  to: string;
  arrivalTime: string;
  durationMinutes: number;
};

export type FlightLayover = {
  airport: string;
  durationMinutes: number;
  overnight?: boolean;
};

export type FlightOption = {
  price: number; // BRL
  tripType: string;
  totalDurationMinutes: number;
  stops: number;
  airlines: string[];
  segments: FlightSegment[];
  layovers: FlightLayover[];
};

export type FlightSearchResult = {
  route: string;
  tripType: 'round_trip' | 'one_way';
  currency: 'BRL';
  total: number;
  cheapest: FlightOption | null;
  options: FlightOption[];
  priceInsights?: {
    lowestPrice?: number;
    priceLevel?: string;
    typicalPriceRange?: number[];
  };
  searchUrl?: string;
  note?: string;
  timestamp: string;
};

// ---------------------------------------------------------------------------
// Hotels
// ---------------------------------------------------------------------------

export type HotelSearchParams = {
  query: string; // cidade, bairro ou nome do hotel
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  adults?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number; // 3.5, 4.0 ou 4.5
  freeCancellationOnly?: boolean;
  limit?: number;
};

export type HotelOption = {
  name: string;
  type?: string;
  ratePerNight: number; // BRL
  ratePerNightFormatted?: string;
  totalRate?: number; // BRL, estadia inteira
  rating?: number;
  reviews?: number;
  hotelClass?: number;
  link?: string;
  amenities?: string[];
};

export type HotelSearchResult = {
  query: string;
  checkIn: string;
  checkOut: string;
  currency: 'BRL';
  total: number;
  cheapest: HotelOption | null;
  properties: HotelOption[];
  note?: string;
  timestamp: string;
};

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

export type MapsSearchParams = {
  query: string; // endereço completo ou "categoria + local"
  latitude?: number;
  longitude?: number;
  zoom?: number; // 3 (país) ... 14 (bairro) ... 21 (rua)
  limit?: number;
};

export type MapsPlace = {
  name: string;
  placeId?: string;
  dataId?: string; // usado para buscar avaliações depois
  address?: string;
  phone?: string;
  website?: string;
  type?: string;
  types?: string[];
  rating?: number;
  reviews?: number;
  price?: string;
  openState?: string;
  hours?: unknown;
  latitude?: number;
  longitude?: number;
  description?: string;
};

export type MapsSearchResult = {
  query: string;
  total: number;
  places: MapsPlace[];
  note?: string;
  timestamp: string;
};

export type MapsPlaceDetailsResult = {
  placeId: string;
  place: MapsPlace | null;
  note?: string;
  timestamp: string;
};

export type MapsPhotosParams = {
  dataId: string; // vem do searchGoogleMaps
  categoryId?: string; // id de uma das categories retornadas
  limit?: number;
};

export type MapsPhoto = {
  title?: string;
  image: string; // URL em resolução maior
  thumbnail?: string;
};

export type MapsPhotoCategory = {
  id: string;
  title: string;
};

export type MapsPhotosResult = {
  dataId: string;
  total: number;
  photos: MapsPhoto[];
  categories: MapsPhotoCategory[];
  note?: string;
  timestamp: string;
};

//TTL - Time To Live (Manteve os 3600000 do config.ts)
/*O que é o cache e para que serve.
 Cada busca na SerpApi consome créditos do seu plano. 
 Se duas pessoas (ou a mesma pessoa duas vezes) perguntarem a mesma coisa em poucos minutos, não faz sentido pagar duas vezes.
  O cache guarda o resultado da primeira busca em memória e, enquanto ele ainda for “novo”, responde a segunda sem chamar a SerpApi.
*/
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1h (a SerpApi também cacheia 1h)

const TRAVEL_CLASS_CODE: Record<TravelClass, number> = {
  economy: 1,
  premium_economy: 2,
  business: 3,
  first: 4,
};

export class SerpAPIService {
  private config: SerpAPIConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(config: SerpAPIConfig) {
    this.config = {
      ...config,
    };
  }

  // Cache simples em memória. Evita gastar créditos com buscas idênticas.
  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const ttl = this.config.cacheTTL ?? DEFAULT_CACHE_TTL_MS;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.timestamp < ttl) {
      console.log('♻️  Using cached result');
      return hit.data as T;
    }
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  // -------------------------------------------------------------------------
  // Trends
  // -------------------------------------------------------------------------

  async getGoogleTrends(keywords: string[]): Promise<TrendingData> {
    console.log('🔍 Fetching Google Trends data for keywords:', keywords);
    if(this.config.disabled) {
      console.warn('⚠️  SerpAPIService is disabled. Returning fixture data.');
      return  risingTrendFixture;
    }

    const keywordTrends: KeywordTrend[] = [];
    const relatedQueriesSet = new Set<RelatedQuery>();
    const risingTopicsSet = new Set<RisingTopic>();

    for (const keyword of keywords) {
      try {
        console.log(`🔍 Fetching data for "${keyword}"...`);
        const trendsData = await this.fetchTrendsData(keyword);
        console.log(`🔍 Fetched trends for "${keyword}":`, trendsData);

        const keywordTrend = this.parseKeywordTrend(keyword, trendsData);
        if (keywordTrend) {
          keywordTrends.push(keywordTrend);
        }

        const relatedQueries = this.parseRelatedQueries(trendsData);
        relatedQueries.forEach(q => relatedQueriesSet.add(q));

        const risingTopics = this.parseRisingTopics(trendsData);
        risingTopics.forEach(t => risingTopicsSet.add(t));
      } catch (error: any) {
        console.warn(`⚠️  Failed to fetch trends for "${keyword}":`, error.message);
      }
    }

    return {
      keywords: keywordTrends.sort((a, b) => b.interestOverTime - a.interestOverTime),
      relatedQueries: Array.from(relatedQueriesSet).sort((a, b) => b.value - a.value).slice(0, 10),
      risingTopics: Array.from(risingTopicsSet).sort((a, b) => b.growth - a.growth).slice(0, 5),
      timestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Shopping
  // -------------------------------------------------------------------------

  async searchGoogleShopping(params: ShoppingSearchParams): Promise<ShoppingSearchResult> {
    const { query, limit = 10 } = params;
    console.log('🛒 Searching Google Shopping for:', query);

    if (this.config.disabled) {
      console.warn('⚠️  SerpAPIService is disabled. Returning shopping fixture data.');
      return { ...shoppingFixture, query };
    }

    const offers = await this.cached(
      `shopping:${JSON.stringify({ ...params, limit: undefined })}`,
      async () => this.parseShoppingOffers(await this.fetchShoppingData(params)),
    );

    return {
      query,
      total: offers.length,
      cheapest: offers[0] ?? null,
      offers: offers.slice(0, limit),
      timestamp: new Date().toISOString(),
    };
  }

  private async fetchShoppingData(params: ShoppingSearchParams): Promise<any> {
    const { query, minPrice, maxPrice, freeShippingOnly, onSaleOnly } = params;

    return getJson({
      engine: 'google_shopping',
      q: query,
      google_domain: 'google.com.br',
      gl: 'br',
      hl: 'pt-br',
      api_key: this.config.apiKey,
      ...(minPrice !== undefined && { min_price: minPrice }),
      ...(maxPrice !== undefined && { max_price: maxPrice }),
      ...(freeShippingOnly && { free_shipping: true }),
      ...(onSaleOnly && { on_sale: true }),
    });
  }

  private parseShoppingOffers(data: any): ShoppingOffer[] {
    if (data?.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    const seen = new Set<string>();

    return (data?.shopping_results ?? [])
      // sem preço numérico não dá para comparar
      .filter((item: any) => typeof item.extracted_price === 'number')
      .map((item: any): ShoppingOffer => ({
        title: item.title,
        store: item.source ?? 'Desconhecida',
        price: item.price,
        priceValue: item.extracted_price,
        oldPrice: item.old_price,
        rating: item.rating,
        reviews: item.reviews,
        delivery: item.delivery,
        tag: item.tag,
        link: item.link ?? item.product_link,
        thumbnail: item.thumbnail,
      }))
      // remove duplicatas (mesma loja + mesmo título)
      .filter((offer: ShoppingOffer) => {
        const key = `${offer.store}|${offer.title}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: ShoppingOffer, b: ShoppingOffer) => a.priceValue - b.priceValue);
  }

  // -------------------------------------------------------------------------
  // Flights
  // -------------------------------------------------------------------------

  async searchGoogleFlights(params: FlightSearchParams): Promise<FlightSearchResult> {
    const { departureId, arrivalId, returnDate, limit = 5 } = params;
    const route = `${departureId} -> ${arrivalId}`;
    const tripType: FlightSearchResult['tripType'] = returnDate ? 'round_trip' : 'one_way';
    console.log('✈️  Searching Google Flights:', route, params.outboundDate, returnDate ?? '(one way)');

    if (this.config.disabled) {
      console.warn('⚠️  SerpAPIService is disabled. No fixture for flights.');
      return {
        route,
        tripType,
        currency: 'BRL',
        total: 0,
        cheapest: null,
        options: [],
        note: 'SerpAPIService is disabled (no fixture available for flights).',
        timestamp: new Date().toISOString(),
      };
    }

    const parsed = await this.cached(
      `flights:${JSON.stringify({ ...params, limit: undefined })}`,
      async () => this.parseFlights(await this.fetchFlightsData(params)),
    );

    return {
      route,
      tripType,
      currency: 'BRL',
      total: parsed.options.length,
      cheapest: parsed.options[0] ?? null,
      options: parsed.options.slice(0, limit),
      priceInsights: parsed.priceInsights,
      searchUrl: parsed.searchUrl,
      timestamp: new Date().toISOString(),
    };
  }

  private async fetchFlightsData(params: FlightSearchParams): Promise<any> {
    const {
      departureId,
      arrivalId,
      outboundDate,
      returnDate,
      adults = 1,
      travelClass = 'economy',
      nonstopOnly,
      maxPrice,
    } = params;

    return getJson({
      engine: 'google_flights',
      departure_id: departureId,
      arrival_id: arrivalId,
      outbound_date: outboundDate,
      type: returnDate ? 1 : 2, // 1 = ida e volta, 2 = só ida
      ...(returnDate && { return_date: returnDate }),
      currency: 'BRL',
      gl: 'br',
      hl: 'pt-br',
      adults,
      travel_class: TRAVEL_CLASS_CODE[travelClass],
      sort_by: 2, // preço
      ...(nonstopOnly && { stops: 1 }), // 1 = só voo direto
      ...(maxPrice !== undefined && { max_price: maxPrice }),
      api_key: this.config.apiKey,
    });
  }

  private parseFlights(data: any): {
    options: FlightOption[];
    priceInsights?: FlightSearchResult['priceInsights'];
    searchUrl?: string;
  } {
    if (data?.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    const raw: any[] = [...(data?.best_flights ?? []), ...(data?.other_flights ?? [])];

    const options = raw
      .filter((flight) => typeof flight.price === 'number')
      .map((flight): FlightOption => {
        const segments: FlightSegment[] = (flight.flights ?? []).map((segment: any) => ({
          airline: segment.airline,
          flightNumber: segment.flight_number,
          from: segment.departure_airport?.id,
          departureTime: segment.departure_airport?.time,
          to: segment.arrival_airport?.id,
          arrivalTime: segment.arrival_airport?.time,
          durationMinutes: segment.duration,
        }));

        const layovers: FlightLayover[] = (flight.layovers ?? []).map((layover: any) => ({
          airport: layover.id,
          durationMinutes: layover.duration,
          ...(layover.overnight && { overnight: true }),
        }));

        return {
          price: flight.price,
          tripType: flight.type,
          totalDurationMinutes: flight.total_duration,
          stops: layovers.length,
          airlines: [...new Set(segments.map((segment) => segment.airline))],
          segments,
          layovers,
        };
      })
      .sort((a, b) => a.price - b.price);

    const insights = data?.price_insights;

    return {
      options,
      priceInsights: insights
        ? {
            lowestPrice: insights.lowest_price,
            priceLevel: insights.price_level,
            typicalPriceRange: insights.typical_price_range,
          }
        : undefined,
      searchUrl: data?.search_metadata?.google_flights_url,
    };
  }

  // -------------------------------------------------------------------------
  // Hotels
  // -------------------------------------------------------------------------

  async searchGoogleHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
    const { query, checkInDate, checkOutDate, limit = 8 } = params;
    console.log('🏨 Searching Google Hotels:', query, checkInDate, '->', checkOutDate);

    if (this.config.disabled) {
      console.warn('⚠️  SerpAPIService is disabled. No fixture for hotels.');
      return {
        query,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        currency: 'BRL',
        total: 0,
        cheapest: null,
        properties: [],
        note: 'SerpAPIService is disabled (no fixture available for hotels).',
        timestamp: new Date().toISOString(),
      };
    }

    const properties = await this.cached(
      `hotels:${JSON.stringify({ ...params, limit: undefined })}`,
      async () => this.parseHotels(await this.fetchHotelsData(params)),
    );

    return {
      query,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      currency: 'BRL',
      total: properties.length,
      cheapest: properties[0] ?? null,
      properties: properties.slice(0, limit),
      timestamp: new Date().toISOString(),
    };
  }

  private async fetchHotelsData(params: HotelSearchParams): Promise<any> {
    const {
      query,
      checkInDate,
      checkOutDate,
      adults = 2,
      minPrice,
      maxPrice,
      minRating,
      freeCancellationOnly,
    } = params;

    // rating da SerpApi: 7 = 3.5+, 8 = 4.0+, 9 = 4.5+
    const ratingCode =
      minRating === undefined ? undefined : minRating >= 4.5 ? 9 : minRating >= 4 ? 8 : minRating >= 3.5 ? 7 : undefined;

    return getJson({
      engine: 'google_hotels',
      q: query,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      adults,
      currency: 'BRL',
      gl: 'br',
      hl: 'pt-br',
      sort_by: 3, // menor preço
      ...(minPrice !== undefined && { min_price: minPrice }),
      ...(maxPrice !== undefined && { max_price: maxPrice }),
      ...(ratingCode !== undefined && { rating: ratingCode }),
      ...(freeCancellationOnly && { free_cancellation: true }),
      api_key: this.config.apiKey,
    });
  }

  private parseHotels(data: any): HotelOption[] {
    if (data?.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    return (data?.properties ?? [])
      .filter((property: any) => typeof property.rate_per_night?.extracted_lowest === 'number')
      .map((property: any): HotelOption => ({
        name: property.name,
        type: property.type,
        ratePerNight: property.rate_per_night.extracted_lowest,
        ratePerNightFormatted: property.rate_per_night.lowest,
        totalRate: property.total_rate?.extracted_lowest,
        rating: property.overall_rating,
        reviews: property.reviews,
        hotelClass: property.extracted_hotel_class,
        link: property.link,
        amenities: Array.isArray(property.amenities) ? property.amenities.slice(0, 6) : undefined,
      }))
      .sort((a: HotelOption, b: HotelOption) => a.ratePerNight - b.ratePerNight);
  }

    // -------------------------------------------------------------------------
  // Maps
  // -------------------------------------------------------------------------

  async searchGoogleMaps(params: MapsSearchParams): Promise<MapsSearchResult> {
    const { query, limit = 5 } = params;
    console.log('📍 Searching Google Maps:', query);

    if (this.config.disabled) {
      console.warn('⚠️  SerpAPIService is disabled. No fixture for maps.');
      return {
        query,
        total: 0,
        places: [],
        note: 'SerpAPIService is disabled (no fixture available for maps).',
        timestamp: new Date().toISOString(),
      };
    }

    const places = await this.cached(
      `maps:${JSON.stringify({ ...params, limit: undefined })}`,
      async () => this.parseMapsPlaces(await this.fetchMapsData(params)),
    );

    return {
      query,
      total: places.length,
      places: places.slice(0, limit),
      timestamp: new Date().toISOString(),
    };
  }

  async getGoogleMapsPlaceDetails(placeId: string): Promise<MapsPlaceDetailsResult> {
    console.log('📍 Fetching Google Maps place details:', placeId);

    if (this.config.disabled) {
      return {
        placeId,
        place: null,
        note: 'SerpAPIService is disabled (no fixture available for maps).',
        timestamp: new Date().toISOString(),
      };
    }

    const place = await this.cached(`maps-place:${placeId}`, async () => {
      const data = await this.fetchMapsPlaceData(placeId);
      return this.parseMapsPlaces(data)[0] ?? null;
    });

    return { placeId, place, timestamp: new Date().toISOString() };
  }

  private async fetchMapsData(params: MapsSearchParams): Promise<any> {
    const { query, latitude, longitude, zoom = 14 } = params;

    return getJson({
      engine: 'google_maps',
      type: 'search',
      q: query,
      google_domain: 'google.com.br',
      gl: 'br',
      hl: 'pt-br',
      ...(latitude !== undefined &&
        longitude !== undefined && { ll: `@${latitude},${longitude},${zoom}z` }),
      api_key: this.config.apiKey,
    });
  }

  private async fetchMapsPlaceData(placeId: string): Promise<any> {
    return getJson({
      engine: 'google_maps',
      type: 'place',
      place_id: placeId,
      google_domain: 'google.com.br',
      gl: 'br',
      hl: 'pt-br',
      api_key: this.config.apiKey,
    });
  }

  private parseMapsPlaces(data: any): MapsPlace[] {
    if (data?.error) {
      // "Google Maps hasn't returned any results" não é falha real: devolve lista vazia
      if (/hasn't returned any results/i.test(data.error)) return [];
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    // Endereço/lugar exato => place_results (objeto único).
    // Busca genérica => local_results (lista).
    const raw: any[] = data?.place_results ? [data.place_results] : (data?.local_results ?? []);

    return raw
      .filter((item: any) => item?.title)
      .map((item: any): MapsPlace => ({
        name: item.title,
        placeId: item.place_id,
        dataId: item.data_id,
        address: item.address,
        phone: item.phone,
        website: item.website,
        type: item.type,
        types: item.types,
        rating: item.rating,
        reviews: item.reviews,
        price: item.price,
        openState: item.open_state,
        hours: item.operating_hours ?? item.hours,
        latitude: item.gps_coordinates?.latitude,
        longitude: item.gps_coordinates?.longitude,
        description: item.description,
      }));
  }

    async getGoogleMapsPhotos(params: MapsPhotosParams): Promise<MapsPhotosResult> {
    const { dataId, limit = 6 } = params;
    console.log('📷 Fetching Google Maps photos:', dataId, params.categoryId ?? '(all)');

    if (this.config.disabled) {
      console.warn('⚠️  SerpAPIService is disabled. No fixture for maps photos.');
      return {
        dataId,
        total: 0,
        photos: [],
        categories: [],
        note: 'SerpAPIService is disabled (no fixture available for maps photos).',
        timestamp: new Date().toISOString(),
      };
    }

    const parsed = await this.cached(
      `maps-photos:${JSON.stringify({ ...params, limit: undefined })}`,
      async () => this.parseMapsPhotos(await this.fetchMapsPhotosData(params)),
    );

    return {
      dataId,
      total: parsed.photos.length,
      photos: parsed.photos.slice(0, limit),
      categories: parsed.categories,
      timestamp: new Date().toISOString(),
    };
  }

  private async fetchMapsPhotosData(params: MapsPhotosParams): Promise<any> {
    const { dataId, categoryId } = params;

    return getJson({
      engine: 'google_maps_photos',
      data_id: dataId,
      hl: 'pt-br',
      ...(categoryId && { category_id: categoryId }),
      api_key: this.config.apiKey,
    });
  }

  private parseMapsPhotos(data: any): {
    photos: MapsPhoto[];
    categories: MapsPhotoCategory[];
  } {
    if (data?.error) {
      if (/hasn't returned any results/i.test(data.error)) {
        return { photos: [], categories: [] };
      }
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    const seen = new Set<string>();

    const photos = (data?.photos ?? [])
      .filter((item: any) => item?.image || item?.thumbnail)
      .map((item: any): MapsPhoto => ({
        title: item.title,
        image: item.image ?? item.thumbnail,
        thumbnail: item.thumbnail,
      }))
      // remove duplicatas
      .filter((photo: MapsPhoto) => {
        if (seen.has(photo.image)) return false;
        seen.add(photo.image);
        return true;
      });

    const categories = (data?.categories ?? [])
      .filter((c: any) => c?.id && c?.title)
      .map((c: any): MapsPhotoCategory => ({ id: c.id, title: c.title }));

    return { photos, categories };
  }

  // -------------------------------------------------------------------------
  // Trends (helpers)
  // -------------------------------------------------------------------------

  private async fetchTrendsData(keyword: string): Promise<any> {
    return getJson({
      engine: 'google_trends',
      q: keyword,
      api_key: this.config.apiKey,
      date: 'now 7-d',
      data_type: 'TIMESERIES',
    });
  }

  private parseKeywordTrend(keyword: string, data: any): KeywordTrend | null {
    if (!data?.interest_over_time?.timeline_data) {
      return null;
    }

    const timelineData = data.interest_over_time.timeline_data;
    const values = timelineData.map((item: any) => item.values?.[0]?.extracted_value || 0);

    if (values.length === 0) {
      return null;
    }

    const avgInterest = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
    const recentValues = values.slice(-3);
    const earlyValues = values.slice(0, 3);
    const recentAvg = recentValues.reduce((sum: number, val: number) => sum + val, 0) / recentValues.length;
    const earlyAvg = earlyValues.reduce((sum: number, val: number) => sum + val, 0) / earlyValues.length;

    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    if (recentAvg > earlyAvg * 1.2) {
      trend = 'rising';
    } else if (recentAvg < earlyAvg * 0.8) {
      trend = 'declining';
    }

    return {
      keyword,
      searchVolume: Math.max(...values),
      interestOverTime: Math.round(avgInterest),
      trend,
    };
  }

  private parseRelatedQueries(data: any): RelatedQuery[] {
    const queries: RelatedQuery[] = [];

    if (data?.related_queries?.top) {
      data.related_queries.top.forEach((item: any) => {
        if (item.query && item.value) {
          queries.push({
            query: item.query,
            value: item.value,
          });
        }
      });
    }

    if (data?.related_queries?.rising) {
      data.related_queries.rising.forEach((item: any) => {
        if (item.query && item.value) {
          queries.push({
            query: item.query,
            value: item.value,
          });
        }
      });
    }

    return queries;
  }

  private parseRisingTopics(data: any): RisingTopic[] {
    const topics: RisingTopic[] = [];

    if (data?.related_topics?.rising) {
      data.related_topics.rising.forEach((item: any) => {
        if (item.topic && item.value) {
          topics.push({
            topic: item.topic.title || item.topic,
            growth: typeof item.value === 'string' && item.value.includes('+')
              ? parseInt(item.value.replace(/\D/g, ''))
              : item.value,
          });
        }
      });
    }

    return topics;
  }

}