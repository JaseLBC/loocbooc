/**
 * In-Memory Store for Development
 * Replace with Supabase in production
 */

// In-memory data stores
const stores = {
  users: new Map(),
  avatars: new Map(),
  garments: new Map(),
  shops: new Map(),
  renders: new Map()
};

// Generate UUID
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const memoryStore = {
  // Users
  async createUser(data) {
    const id = uuid();
    const user = { id, ...data, created_at: new Date().toISOString() };
    stores.users.set(id, user);
    return user;
  },
  
  async getUser(id) {
    return stores.users.get(id) || null;
  },
  
  async getUserByEmail(email) {
    for (const user of stores.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  },
  
  // Avatars
  async createAvatar(userId, data) {
    const id = uuid();
    const avatar = { 
      id, 
      user_id: userId, 
      ...data, 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    stores.avatars.set(id, avatar);
    return avatar;
  },
  
  async getAvatarByUserId(userId) {
    for (const avatar of stores.avatars.values()) {
      if (avatar.user_id === userId) return avatar;
    }
    return null;
  },
  
  async updateAvatar(id, data) {
    const avatar = stores.avatars.get(id);
    if (!avatar) return null;
    const updated = { ...avatar, ...data, updated_at: new Date().toISOString() };
    stores.avatars.set(id, updated);
    return updated;
  },
  
  async deleteAvatar(id) {
    return stores.avatars.delete(id);
  },
  
  // Garments
  async createGarment(data) {
    const id = uuid();
    const garment = { 
      id, 
      ...data, 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    stores.garments.set(id, garment);
    return garment;
  },
  
  async getGarment(id) {
    return stores.garments.get(id) || null;
  },
  
  async getGarmentByShopifyId(shop, productId) {
    for (const garment of stores.garments.values()) {
      if (garment.shop === shop && garment.shopify_product_id === productId) {
        return garment;
      }
    }
    return null;
  },
  
  async listGarments(shop, { limit = 50, offset = 0, tryonEnabled } = {}) {
    let results = Array.from(stores.garments.values())
      .filter(g => g.shop === shop);
    
    if (tryonEnabled !== undefined) {
      results = results.filter(g => g.tryon_enabled === tryonEnabled);
    }
    
    return results.slice(offset, offset + limit);
  },
  
  async updateGarment(id, data) {
    const garment = stores.garments.get(id);
    if (!garment) return null;
    const updated = { ...garment, ...data, updated_at: new Date().toISOString() };
    stores.garments.set(id, updated);
    return updated;
  },
  
  // Shops
  async createShop(data) {
    const id = uuid();
    const shop = { id, ...data, created_at: new Date().toISOString() };
    stores.shops.set(data.shop_domain, shop);
    return shop;
  },
  
  async getShop(shopDomain) {
    return stores.shops.get(shopDomain) || null;
  },
  
  async updateShop(shopDomain, data) {
    const shop = stores.shops.get(shopDomain);
    if (!shop) return null;
    const updated = { ...shop, ...data, updated_at: new Date().toISOString() };
    stores.shops.set(shopDomain, updated);
    return updated;
  },
  
  // Renders (cached try-on results)
  async createRender(data) {
    const id = uuid();
    const render = { id, ...data, created_at: new Date().toISOString() };
    const key = `${data.avatar_id}-${data.garment_id}-${data.size}-${data.color}`;
    stores.renders.set(key, render);
    return render;
  },
  
  async getRender(avatarId, garmentId, size, color) {
    const key = `${avatarId}-${garmentId}-${size}-${color}`;
    return stores.renders.get(key) || null;
  },
  
  // Debug
  getStats() {
    return {
      users: stores.users.size,
      avatars: stores.avatars.size,
      garments: stores.garments.size,
      shops: stores.shops.size,
      renders: stores.renders.size
    };
  }
};

export default memoryStore;
