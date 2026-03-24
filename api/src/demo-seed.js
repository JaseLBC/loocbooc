/**
 * Demo Seed Data
 * Seeds in-memory store with sample Charcoal products for demos
 */

export const DEMO_PRODUCTS = [
  {
    id: 'charcoal-1',
    shop: 'charcoal-clothing.myshopify.com',
    shopify_product_id: '8001234567890',
    title: 'Linen Midi Dress - Coal',
    product_type: 'Dress',
    images: [
      'https://cdn.shopify.com/charcoal/dress-1-front.jpg',
      'https://cdn.shopify.com/charcoal/dress-1-back.jpg',
    ],
    variants: [
      { id: 'v1', option1: 'XS', title: 'XS' },
      { id: 'v2', option1: 'S', title: 'S' },
      { id: 'v3', option1: 'M', title: 'M' },
      { id: 'v4', option1: 'L', title: 'L' },
      { id: 'v5', option1: 'XL', title: 'XL' },
    ],
    size_chart: {
      XS: { bust: 80, waist: 60, hips: 85 },
      S: { bust: 85, waist: 65, hips: 90 },
      M: { bust: 90, waist: 70, hips: 95 },
      L: { bust: 95, waist: 75, hips: 100 },
      XL: { bust: 100, waist: 80, hips: 105 }
    },
    tryon_enabled: true
  },
  {
    id: 'charcoal-2',
    shop: 'charcoal-clothing.myshopify.com',
    shopify_product_id: '8001234567891',
    title: 'Wide Leg Trouser - Ink',
    product_type: 'Pants',
    images: [
      'https://cdn.shopify.com/charcoal/trouser-1-front.jpg',
    ],
    variants: [
      { id: 'v1', option1: '6', title: '6' },
      { id: 'v2', option1: '8', title: '8' },
      { id: 'v3', option1: '10', title: '10' },
      { id: 'v4', option1: '12', title: '12' },
      { id: 'v5', option1: '14', title: '14' },
    ],
    size_chart: {
      '6': { waist: 62, hips: 88 },
      '8': { waist: 66, hips: 92 },
      '10': { waist: 70, hips: 96 },
      '12': { waist: 74, hips: 100 },
      '14': { waist: 78, hips: 104 }
    },
    tryon_enabled: true
  },
  {
    id: 'charcoal-3',
    shop: 'charcoal-clothing.myshopify.com',
    shopify_product_id: '8001234567892',
    title: 'Cropped Blazer - Bone',
    product_type: 'Jacket',
    images: [
      'https://cdn.shopify.com/charcoal/blazer-1-front.jpg',
    ],
    variants: [
      { id: 'v1', option1: 'XS', title: 'XS' },
      { id: 'v2', option1: 'S', title: 'S' },
      { id: 'v3', option1: 'M', title: 'M' },
      { id: 'v4', option1: 'L', title: 'L' },
    ],
    size_chart: {
      XS: { bust: 82, shoulders: 38 },
      S: { bust: 86, shoulders: 39 },
      M: { bust: 90, shoulders: 40 },
      L: { bust: 94, shoulders: 41 }
    },
    tryon_enabled: true
  }
];

export const DEMO_AVATARS = [
  {
    id: 'demo-avatar-1',
    user_id: 'demo-user-1',
    source: 'measurements',
    measurements: {
      height: 165,
      weight: 58,
      bust: 88,
      waist: 68,
      hips: 94,
      inseam: 76
    },
    body_type: 'hourglass',
    gender: 'female'
  }
];
