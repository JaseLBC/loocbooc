/**
 * Analytics Routes
 * Track events and get conversion metrics
 */

import { trackEvent, EVENTS, getShopAnalytics, getConversionMetrics } from '../services/analytics.js';

export default async function analyticsRoutes(fastify) {
  
  // Track an event
  fastify.post('/track', async (request, reply) => {
    const { eventType, shop, garmentId, metadata } = request.body;
    const userId = request.user?.id || request.body.userId || null;
    
    if (!eventType) {
      return reply.status(400).send({ error: 'eventType required' });
    }
    
    const result = await trackEvent({
      eventType,
      userId,
      shop: shop || 'unknown',
      garmentId,
      metadata
    });
    
    return result;
  });
  
  // Get shop analytics dashboard
  fastify.get('/shop/:shop', async (request, reply) => {
    const { shop } = request.params;
    const { startDate, endDate, groupBy } = request.query;
    
    // TODO: Add shop owner authentication
    
    try {
      const analytics = await getShopAnalytics(shop, { startDate, endDate, groupBy });
      return { success: true, analytics };
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });
  
  // Get conversion metrics
  fastify.get('/shop/:shop/conversion', async (request, reply) => {
    const { shop } = request.params;
    const { startDate, endDate } = request.query;
    
    // TODO: Add shop owner authentication
    
    try {
      const metrics = await getConversionMetrics(shop, { startDate, endDate });
      return { success: true, metrics };
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });
  
  // Get available event types
  fastify.get('/events', async () => {
    return {
      events: Object.entries(EVENTS).map(([key, value]) => ({
        name: key,
        type: value
      }))
    };
  });
}
