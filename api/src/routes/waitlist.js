/**
 * Waitlist Routes
 * Capture early interest from brands and customers
 */

import { supabase, isConfigured, db } from '../services/supabase.js';

// In-memory waitlist for dev
const memoryWaitlist = [];

export default async function waitlistRoutes(fastify) {
  
  // Add to waitlist
  fastify.post('/join', async (request, reply) => {
    const { 
      email, 
      type, // 'brand' | 'customer' | 'investor' | 'cto'
      company,
      monthlyOrders,
      source,
      notes
    } = request.body;
    
    if (!email) {
      return reply.status(400).send({ error: 'Email required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.status(400).send({ error: 'Invalid email format' });
    }
    
    const entry = {
      id: `wl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: email.toLowerCase().trim(),
      type: type || 'customer',
      company,
      monthly_orders: monthlyOrders,
      source: source || 'direct',
      notes,
      created_at: new Date().toISOString()
    };
    
    if (!isConfigured) {
      // Check for duplicates in memory
      const existing = memoryWaitlist.find(e => e.email === entry.email);
      if (existing) {
        return { 
          success: true, 
          message: 'You\'re already on the waitlist!',
          position: memoryWaitlist.indexOf(existing) + 1
        };
      }
      
      memoryWaitlist.push(entry);
      console.log('📧 Waitlist signup:', entry.email, entry.type);
      
      return { 
        success: true, 
        message: 'You\'re on the list!',
        position: memoryWaitlist.length
      };
    }
    
    // Check for existing in Supabase
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id, created_at')
      .eq('email', entry.email)
      .single();
    
    if (existing) {
      return { 
        success: true, 
        message: 'You\'re already on the waitlist!'
      };
    }
    
    // Insert new entry
    const { data, error } = await supabase
      .from('waitlist')
      .insert(entry)
      .select()
      .single();
    
    if (error) {
      console.error('Waitlist error:', error);
      return reply.status(500).send({ error: 'Failed to join waitlist' });
    }
    
    return { 
      success: true, 
      message: 'You\'re on the list!'
    };
  });
  
  // Get waitlist stats (admin only)
  fastify.get('/stats', async (request, reply) => {
    // TODO: Add admin auth
    
    if (!isConfigured) {
      const byType = memoryWaitlist.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {});
      
      return {
        total: memoryWaitlist.length,
        byType,
        recentSignups: memoryWaitlist.slice(-10).reverse()
      };
    }
    
    const { data: entries, error } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    const byType = entries.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total: entries.length,
      byType,
      recentSignups: entries.slice(0, 10)
    };
  });
  
  // Export waitlist (admin only)
  fastify.get('/export', async (request, reply) => {
    // TODO: Add admin auth
    
    if (!isConfigured) {
      return { entries: memoryWaitlist };
    }
    
    const { data, error } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    return { entries: data };
  });
}
