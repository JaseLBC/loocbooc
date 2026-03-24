/**
 * Shopify Webhook Routes
 * Handles product updates, orders, app uninstall
 */

import crypto from 'crypto';
import { db } from '../services/supabase.js';
import { generateGarmentFromPhotos } from '../services/garment-ai.js';
import { trackEvent, EVENTS } from '../services/analytics.js';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

/**
 * Verify Shopify webhook HMAC
 */
function verifyWebhook(rawBody, hmacHeader) {
  if (!SHOPIFY_API_SECRET) {
    console.warn('⚠️ SHOPIFY_API_SECRET not set, skipping webhook verification');
    return true;
  }
  
  const hmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');
  
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hmacHeader));
}

export default async function webhookRoutes(fastify) {
  
  // Add raw body parsing for webhook verification
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      req.rawBody = body.toString();
      const json = JSON.parse(body);
      done(null, json);
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });
  
  // Product created/updated webhook
  fastify.post('/products/create', async (request, reply) => {
    return handleProductWebhook(request, reply, 'create');
  });
  
  fastify.post('/products/update', async (request, reply) => {
    return handleProductWebhook(request, reply, 'update');
  });
  
  fastify.post('/products/delete', async (request, reply) => {
    const shop = request.headers['x-shopify-shop-domain'];
    const hmac = request.headers['x-shopify-hmac-sha256'];
    
    if (!verifyWebhook(request.rawBody, hmac)) {
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }
    
    const { id } = request.body;
    
    console.log(`🗑️ Product deleted: ${id} from ${shop}`);
    
    // Mark garment as disabled (don't delete, keep for analytics)
    await db.saveGarment({
      shop,
      shopify_product_id: String(id),
      tryon_enabled: false,
      deleted_at: new Date().toISOString()
    });
    
    return { received: true };
  });
  
  // Order created webhook (for conversion tracking)
  fastify.post('/orders/create', async (request, reply) => {
    const shop = request.headers['x-shopify-shop-domain'];
    const hmac = request.headers['x-shopify-hmac-sha256'];
    
    if (!verifyWebhook(request.rawBody, hmac)) {
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }
    
    const order = request.body;
    
    console.log(`📦 Order created: ${order.name} from ${shop}`);
    
    // Track conversion for analytics
    for (const lineItem of order.line_items || []) {
      await trackEvent({
        eventType: EVENTS.PURCHASE,
        shop,
        garmentId: String(lineItem.product_id),
        metadata: {
          orderId: order.id,
          orderName: order.name,
          variantId: lineItem.variant_id,
          quantity: lineItem.quantity,
          price: lineItem.price
        }
      });
      
      // Check if customer used try-on (would need to track this in session)
      // For now, we'll use customer email to correlate later
    }
    
    return { received: true };
  });
  
  // App uninstalled webhook
  fastify.post('/app/uninstalled', async (request, reply) => {
    const shop = request.headers['x-shopify-shop-domain'];
    const hmac = request.headers['x-shopify-hmac-sha256'];
    
    if (!verifyWebhook(request.rawBody, hmac)) {
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }
    
    console.log(`❌ App uninstalled from ${shop}`);
    
    // Mark shop as uninstalled (keep data for potential reinstall)
    await db.saveShop({
      shop_domain: shop,
      uninstalled_at: new Date().toISOString(),
      access_token: null // Clear token
    });
    
    return { received: true };
  });
  
  // Customers data request (GDPR)
  fastify.post('/customers/data_request', async (request, reply) => {
    const shop = request.headers['x-shopify-shop-domain'];
    const hmac = request.headers['x-shopify-hmac-sha256'];
    
    if (!verifyWebhook(request.rawBody, hmac)) {
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }
    
    const { customer } = request.body;
    console.log(`📋 Customer data request for ${customer.email} from ${shop}`);
    
    // TODO: Compile customer data and send to shop
    // For MVP, just acknowledge
    
    return { received: true };
  });
  
  // Customers redact (GDPR - delete customer data)
  fastify.post('/customers/redact', async (request, reply) => {
    const shop = request.headers['x-shopify-shop-domain'];
    const hmac = request.headers['x-shopify-hmac-sha256'];
    
    if (!verifyWebhook(request.rawBody, hmac)) {
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }
    
    const { customer } = request.body;
    console.log(`🗑️ Customer redact request for ${customer.email} from ${shop}`);
    
    // TODO: Delete customer avatar and associated data
    
    return { received: true };
  });
  
  // Shop redact (GDPR - delete all shop data)
  fastify.post('/shop/redact', async (request, reply) => {
    const shop = request.headers['x-shopify-shop-domain'];
    const hmac = request.headers['x-shopify-hmac-sha256'];
    
    if (!verifyWebhook(request.rawBody, hmac)) {
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }
    
    console.log(`🗑️ Shop redact request for ${shop}`);
    
    // TODO: Delete all shop data
    
    return { received: true };
  });
}

/**
 * Handle product create/update webhook
 */
async function handleProductWebhook(request, reply, action) {
  const shop = request.headers['x-shopify-shop-domain'];
  const hmac = request.headers['x-shopify-hmac-sha256'];
  
  if (!verifyWebhook(request.rawBody, hmac)) {
    return reply.status(401).send({ error: 'Invalid webhook signature' });
  }
  
  const product = request.body;
  
  console.log(`📦 Product ${action}: ${product.title} (${product.id}) from ${shop}`);
  
  // Extract images
  const images = (product.images || []).map(img => img.src);
  
  // Generate 3D garment model from images
  const garmentModel = await generateGarmentFromPhotos({
    images,
    productType: product.product_type,
    title: product.title,
    variants: product.variants
  });
  
  // Save to database
  await db.saveGarment({
    shop,
    shopify_product_id: String(product.id),
    title: product.title,
    product_type: product.product_type,
    images,
    variants: product.variants,
    model_url: garmentModel.url,
    model_data: garmentModel.data,
    tryon_enabled: true,
    synced_at: new Date().toISOString()
  });
  
  return { received: true, garmentId: `${shop}:${product.id}` };
}
