/**
 * Analytics Service
 * Tracks try-on events for conversion analysis
 */

import { supabase, isConfigured } from './supabase.js';

// In-memory analytics for dev
const memoryEvents = [];

/**
 * Track an event
 */
export async function trackEvent({
  eventType,
  userId = null,
  shop,
  garmentId = null,
  metadata = {}
}) {
  const event = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    event_type: eventType,
    user_id: userId,
    shop,
    garment_id: garmentId,
    metadata,
    created_at: new Date().toISOString()
  };
  
  if (!isConfigured) {
    memoryEvents.push(event);
    console.log('📊 Analytics:', eventType, { shop, garmentId, ...metadata });
    return { success: true, event };
  }
  
  try {
    const { data, error } = await supabase
      .from('tryon_events')
      .insert(event)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, event: data };
  } catch (err) {
    console.error('Analytics error:', err);
    return { success: false, error: err.message };
  }
}

// Event type constants
export const EVENTS = {
  // Try-on funnel
  TRYON_BUTTON_CLICK: 'tryon_button_click',
  TRYON_MODAL_OPEN: 'tryon_modal_open',
  TRYON_MODAL_CLOSE: 'tryon_modal_close',
  
  // Avatar events
  AVATAR_CREATE_START: 'avatar_create_start',
  AVATAR_CREATE_MEASUREMENTS: 'avatar_create_measurements',
  AVATAR_CREATE_PHOTOS: 'avatar_create_photos',
  AVATAR_CREATE_COMPLETE: 'avatar_create_complete',
  
  // Try-on interaction
  TRYON_SIZE_SELECT: 'tryon_size_select',
  TRYON_COLOR_SELECT: 'tryon_color_select',
  TRYON_ROTATE: 'tryon_rotate',
  TRYON_ZOOM: 'tryon_zoom',
  TRYON_VIEW_MODEL: 'tryon_view_model',
  TRYON_VIEW_AVATAR: 'tryon_view_avatar',
  TRYON_VIEW_SPLIT: 'tryon_view_split',
  
  // Conversion events
  ADD_TO_CART: 'add_to_cart',
  ADD_TO_CART_FROM_TRYON: 'add_to_cart_from_tryon',
  PURCHASE: 'purchase',
  PURCHASE_WITH_TRYON: 'purchase_with_tryon',
  
  // Return events
  RETURN_INITIATED: 'return_initiated',
  RETURN_REASON_SIZE: 'return_reason_size',
  RETURN_REASON_FIT: 'return_reason_fit',
  RETURN_REASON_OTHER: 'return_reason_other'
};

/**
 * Get analytics summary for a shop
 */
export async function getShopAnalytics(shop, { startDate, endDate, groupBy = 'day' } = {}) {
  if (!isConfigured) {
    // Return demo analytics
    const filtered = memoryEvents.filter(e => e.shop === shop);
    return {
      totalEvents: filtered.length,
      uniqueUsers: new Set(filtered.map(e => e.user_id).filter(Boolean)).size,
      eventBreakdown: groupByKey(filtered, 'event_type'),
      conversionFunnel: calculateFunnel(filtered)
    };
  }
  
  let query = supabase
    .from('tryon_events')
    .select('*')
    .eq('shop', shop);
  
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }
  
  const { data: events, error } = await query;
  
  if (error) {
    throw new Error(error.message);
  }
  
  return {
    totalEvents: events.length,
    uniqueUsers: new Set(events.map(e => e.user_id).filter(Boolean)).size,
    eventBreakdown: groupByKey(events, 'event_type'),
    conversionFunnel: calculateFunnel(events),
    byGarment: groupByKey(events, 'garment_id'),
    timeline: groupByTime(events, groupBy)
  };
}

/**
 * Get conversion metrics
 */
export async function getConversionMetrics(shop, { startDate, endDate } = {}) {
  const analytics = await getShopAnalytics(shop, { startDate, endDate });
  
  const funnel = analytics.conversionFunnel;
  
  return {
    tryOnRate: funnel.modalOpens > 0 
      ? (funnel.avatarCreated / funnel.modalOpens * 100).toFixed(1) + '%'
      : 'N/A',
    
    tryOnToCartRate: funnel.avatarCreated > 0
      ? (funnel.addToCartFromTryon / funnel.avatarCreated * 100).toFixed(1) + '%'
      : 'N/A',
    
    tryOnLift: funnel.addToCartTotal > 0
      ? ((funnel.addToCartFromTryon / funnel.addToCartTotal - 1) * 100).toFixed(1) + '%'
      : 'N/A',
    
    returnRateReduction: 'Coming soon', // Need historical data
    
    raw: funnel
  };
}

// Helper functions
function groupByKey(events, key) {
  return events.reduce((acc, e) => {
    const val = e[key] || 'unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

function groupByTime(events, groupBy) {
  return events.reduce((acc, e) => {
    let key;
    const date = new Date(e.created_at);
    
    switch (groupBy) {
      case 'hour':
        key = date.toISOString().slice(0, 13) + ':00';
        break;
      case 'day':
        key = date.toISOString().slice(0, 10);
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
        break;
      default:
        key = date.toISOString().slice(0, 10);
    }
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

function calculateFunnel(events) {
  return {
    buttonClicks: events.filter(e => e.event_type === EVENTS.TRYON_BUTTON_CLICK).length,
    modalOpens: events.filter(e => e.event_type === EVENTS.TRYON_MODAL_OPEN).length,
    avatarStarted: events.filter(e => e.event_type === EVENTS.AVATAR_CREATE_START).length,
    avatarCreated: events.filter(e => e.event_type === EVENTS.AVATAR_CREATE_COMPLETE).length,
    sizeSelected: events.filter(e => e.event_type === EVENTS.TRYON_SIZE_SELECT).length,
    addToCartFromTryon: events.filter(e => e.event_type === EVENTS.ADD_TO_CART_FROM_TRYON).length,
    addToCartTotal: events.filter(e => e.event_type.includes('add_to_cart')).length,
    purchaseWithTryon: events.filter(e => e.event_type === EVENTS.PURCHASE_WITH_TRYON).length
  };
}

export default { trackEvent, EVENTS, getShopAnalytics, getConversionMetrics };
