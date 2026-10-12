import type { ShoppingSearchResult } from '../src/services/serpApiService.ts';

// Fixture usada quando o SerpAPIService está com `disabled: true` (sem gastar créditos).
// Ajuste o caminho do import acima conforme a estrutura do seu projeto.
const offers = [
  {
    title: 'Fone de Ouvido Bluetooth XYZ Pro',
    store: 'Loja Exemplo A',
    price: 'R$ 129,90',
    priceValue: 129.9,
    oldPrice: 'R$ 199,90',
    rating: 4.6,
    reviews: 1523,
    delivery: 'Frete grátis',
    tag: '35% OFF',
    link: 'https://example.com/produto-a',
  },
  {
    title: 'Fone de Ouvido Bluetooth XYZ Pro',
    store: 'Loja Exemplo B',
    price: 'R$ 139,00',
    priceValue: 139,
    rating: 4.5,
    reviews: 842,
    delivery: 'Entrega em 3 dias',
    link: 'https://example.com/produto-b',
  },
  {
    title: 'Fone de Ouvido Bluetooth XYZ Pro',
    store: 'Loja Exemplo C',
    price: 'R$ 159,90',
    priceValue: 159.9,
    rating: 4.7,
    reviews: 310,
    delivery: 'Frete grátis',
    link: 'https://example.com/produto-c',
  },
];

export const shoppingFixture: ShoppingSearchResult = {
  query: 'fixture',
  total: offers.length,
  cheapest: offers[0] ?? null,
  offers,
  timestamp: new Date(0).toISOString(),
};
