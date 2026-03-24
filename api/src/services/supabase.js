/**
 * Supabase Client with In-Memory Fallback
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export const isConfigured = !!(supabaseUrl && supabaseKey);

// In-memory store for development without Supabase
const memoryStore = {
  avatars: new Map(),
  garments: new Map(),
  renders: new Map(),
  shops: new Map()
};

if (!isConfigured) {
  console.warn('⚠️  Supabase credentials not configured. Using in-memory store for development.');
}

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Helper functions that work with either Supabase or memory store
export const db = {
  // Avatar operations
  async getAvatar(userId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('user_id', userId)
        .single();
      return { data, error };
    }
    const avatar = memoryStore.avatars.get(userId);
    return { data: avatar || null, error: null };
  },
  
  async saveAvatar(userId, avatar) {
    if (supabase) {
      const { data, error } = await supabase
        .from('avatars')
        .upsert({ ...avatar, user_id: userId })
        .select()
        .single();
      return { data, error };
    }
    const saved = { ...avatar, id: userId, user_id: userId, created_at: new Date().toISOString() };
    memoryStore.avatars.set(userId, saved);
    return { data: saved, error: null };
  },
  
  async deleteAvatar(userId) {
    if (supabase) {
      const { error } = await supabase
        .from('avatars')
        .delete()
        .eq('user_id', userId);
      return { error };
    }
    memoryStore.avatars.delete(userId);
    return { error: null };
  },
  
  // Garment operations
  async getGarment(id) {
    if (supabase) {
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('id', id)
        .single();
      return { data, error };
    }
    const garment = memoryStore.garments.get(id);
    return { data: garment || null, error: null };
  },
  
  async getGarmentByShopifyId(shop, productId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('shop', shop)
        .eq('shopify_product_id', productId)
        .single();
      return { data, error };
    }
    const key = `${shop}:${productId}`;
    const garment = memoryStore.garments.get(key);
    return { data: garment || null, error: null };
  },
  
  async saveGarment(garment) {
    if (supabase) {
      const { data, error } = await supabase
        .from('garments')
        .upsert(garment)
        .select()
        .single();
      return { data, error };
    }
    const id = garment.id || `${garment.shop}:${garment.shopify_product_id}`;
    const saved = { ...garment, id, created_at: new Date().toISOString() };
    memoryStore.garments.set(id, saved);
    return { data: saved, error: null };
  },
  
  async listGarments(shop, { limit = 50, offset = 0 } = {}) {
    if (supabase) {
      const { data, error, count } = await supabase
        .from('garments')
        .select('*', { count: 'exact' })
        .eq('shop', shop)
        .eq('tryon_enabled', true)
        .range(offset, offset + limit - 1);
      return { data, error, count };
    }
    const garments = Array.from(memoryStore.garments.values())
      .filter(g => g.shop === shop && g.tryon_enabled !== false);
    return { 
      data: garments.slice(offset, offset + limit), 
      error: null, 
      count: garments.length 
    };
  },
  
  // Shop operations
  async getShop(domain) {
    if (supabase) {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('shop_domain', domain)
        .single();
      return { data, error };
    }
    const shop = memoryStore.shops.get(domain);
    return { data: shop || null, error: null };
  },
  
  async saveShop(shop) {
    if (supabase) {
      const { data, error } = await supabase
        .from('shops')
        .upsert(shop)
        .select()
        .single();
      return { data, error };
    }
    const saved = { ...shop, id: shop.shop_domain, created_at: new Date().toISOString() };
    memoryStore.shops.set(shop.shop_domain, saved);
    return { data: saved, error: null };
  }
};

export default supabase;
