/**
 * Garment Routes
 * - Sync products from Shopify
 * - Generate 3D from product photos
 * - Get garment for try-on
 */

import { supabase } from '../services/supabase.js';
import { generateGarmentFromPhotos } from '../services/garment-ai.js';

export default async function garmentRoutes(fastify) {
  
  // Get garment by Shopify product ID
  fastify.get('/:shopifyProductId', async (request, reply) => {
    const { shopifyProductId } = request.params;
    const { shop } = request.query;
    
    if (!shop) {
      return reply.status(400).send({ error: 'Shop parameter required' });
    }
    
    const { data, error } = await supabase
      .from('garments')
      .select('*')
      .eq('shopify_product_id', shopifyProductId)
      .eq('shop', shop)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return reply.status(500).send({ error: error.message });
    }
    
    if (!data) {
      return reply.status(404).send({ error: 'Garment not found' });
    }
    
    return { garment: data };
  });
  
  // List garments for a shop (with try-on enabled)
  fastify.get('/', async (request, reply) => {
    const { shop, limit = 50, offset = 0 } = request.query;
    
    if (!shop) {
      return reply.status(400).send({ error: 'Shop parameter required' });
    }
    
    const { data, error, count } = await supabase
      .from('garments')
      .select('*', { count: 'exact' })
      .eq('shop', shop)
      .eq('tryon_enabled', true)
      .range(offset, offset + limit - 1);
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    return { 
      garments: data,
      total: count,
      limit,
      offset
    };
  });
  
  // Sync garment from Shopify (called by merchant)
  fastify.post('/sync', async (request, reply) => {
    const { shop, productId, accessToken } = request.body;
    
    if (!shop || !productId || !accessToken) {
      return reply.status(400).send({ error: 'shop, productId, and accessToken required' });
    }
    
    // Fetch product from Shopify
    const shopifyResponse = await fetch(
      `https://${shop}/admin/api/2024-01/products/${productId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      }
    );
    
    if (!shopifyResponse.ok) {
      return reply.status(shopifyResponse.status).send({ 
        error: 'Failed to fetch product from Shopify' 
      });
    }
    
    const { product } = await shopifyResponse.json();
    
    // Extract images for 3D generation
    const images = product.images.map(img => img.src);
    
    // Generate 3D model from product photos
    const garmentModel = await generateGarmentFromPhotos({
      images,
      productType: product.product_type,
      title: product.title,
      variants: product.variants
    });
    
    // Store in database
    const { data, error } = await supabase
      .from('garments')
      .upsert({
        shop,
        shopify_product_id: productId,
        title: product.title,
        product_type: product.product_type,
        images,
        variants: product.variants,
        model_url: garmentModel.url,
        model_data: garmentModel.data,
        tryon_enabled: true,
        synced_at: new Date().toISOString()
      }, {
        onConflict: 'shop,shopify_product_id'
      })
      .select()
      .single();
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    return { 
      success: true, 
      garment: data,
      message: 'Garment synced and 3D model generated'
    };
  });
  
  // Bulk sync all products (webhook or manual trigger)
  fastify.post('/sync-all', async (request, reply) => {
    const { shop, accessToken } = request.body;
    
    // TODO: Implement pagination for large catalogs
    // TODO: Queue background job for processing
    
    return { 
      status: 'pending_implementation',
      message: 'Bulk sync will be processed in background'
    };
  });
  
  // Enable/disable try-on for specific product
  fastify.patch('/:shopifyProductId/tryon', async (request, reply) => {
    const { shopifyProductId } = request.params;
    const { shop, enabled } = request.body;
    
    const { data, error } = await supabase
      .from('garments')
      .update({ tryon_enabled: enabled })
      .eq('shopify_product_id', shopifyProductId)
      .eq('shop', shop)
      .select()
      .single();
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    return { success: true, garment: data };
  });
}
