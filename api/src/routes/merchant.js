/**
 * Merchant Routes
 * ROI calculations, return predictions, shop management
 */

import { calculateReturnRisk, calculateMerchantROI } from '../services/returns-predictor.js';
import { getShopAnalytics, getConversionMetrics } from '../services/analytics.js';

export default async function merchantRoutes(fastify) {
  
  // Calculate ROI for a merchant
  fastify.post('/roi', async (request, reply) => {
    const {
      monthlyOrders,
      averageOrderValue,
      currentReturnRate,
      returnProcessingCost
    } = request.body;
    
    if (!monthlyOrders || !averageOrderValue) {
      return reply.status(400).send({ error: 'monthlyOrders and averageOrderValue required' });
    }
    
    const roi = calculateMerchantROI({
      monthlyOrders,
      averageOrderValue,
      currentReturnRate,
      returnProcessingCost
    });
    
    return { roi };
  });
  
  // Predict return risk for a specific purchase
  fastify.post('/return-risk', async (request, reply) => {
    const {
      bust, waist, hips,
      selectedSize,
      sizeChart,
      garmentType
    } = request.body;
    
    if (!bust || !waist || !hips || !selectedSize) {
      return reply.status(400).send({ 
        error: 'bust, waist, hips, and selectedSize required' 
      });
    }
    
    const risk = calculateReturnRisk({
      customerMeasurements: { bust, waist, hips },
      selectedSize,
      sizeChart,
      garmentType
    });
    
    return risk;
  });
  
  // Get shop dashboard data
  fastify.get('/dashboard/:shop', async (request, reply) => {
    const { shop } = request.params;
    const { startDate, endDate } = request.query;
    
    try {
      const [analytics, metrics] = await Promise.all([
        getShopAnalytics(shop, { startDate, endDate }),
        getConversionMetrics(shop, { startDate, endDate })
      ]);
      
      // Calculate example ROI based on analytics
      // In production, this would use actual shop data
      const exampleROI = calculateMerchantROI({
        monthlyOrders: 500,
        averageOrderValue: 150,
        currentReturnRate: 0.35
      });
      
      return {
        shop,
        analytics,
        metrics,
        projectedROI: exampleROI
      };
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });
  
  // Bulk return risk analysis for product catalog
  fastify.post('/catalog-analysis', async (request, reply) => {
    const { products, averageCustomer } = request.body;
    
    if (!products || !Array.isArray(products)) {
      return reply.status(400).send({ error: 'products array required' });
    }
    
    // Default average customer if not provided
    const customer = averageCustomer || { bust: 90, waist: 70, hips: 95 };
    
    const analysis = products.map(product => {
      const risks = {};
      const sizes = Object.keys(product.sizeChart || {});
      
      sizes.forEach(size => {
        risks[size] = calculateReturnRisk({
          customerMeasurements: customer,
          selectedSize: size,
          sizeChart: product.sizeChart,
          garmentType: product.type
        });
      });
      
      // Find best size
      const bestSize = sizes.reduce((best, size) => 
        (risks[size].returnRisk < (risks[best]?.returnRisk || 1)) ? size : best
      , sizes[0]);
      
      return {
        productId: product.id,
        title: product.title,
        type: product.type,
        bestSize,
        riskBySize: risks
      };
    });
    
    return { analysis };
  });
}
