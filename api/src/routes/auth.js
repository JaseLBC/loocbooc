/**
 * Authentication Routes
 * - Shopify OAuth for merchant installation
 * - Loocbooc account for end customers
 */

import { supabase } from '../services/supabase.js';

export default async function authRoutes(fastify) {
  
  // Shopify OAuth - Start installation
  fastify.get('/shopify', async (request, reply) => {
    const { shop } = request.query;
    
    if (!shop) {
      return reply.status(400).send({ error: 'Missing shop parameter' });
    }
    
    // TODO: Generate OAuth URL and redirect
    const clientId = process.env.SHOPIFY_API_KEY;
    const scopes = process.env.SHOPIFY_SCOPES || 'read_products,read_customers';
    const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/auth/shopify/callback`;
    
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    return reply.redirect(authUrl);
  });
  
  // Shopify OAuth - Callback
  fastify.get('/shopify/callback', async (request, reply) => {
    const { code, shop, hmac } = request.query;
    
    // TODO: Validate HMAC
    // TODO: Exchange code for access token
    // TODO: Store shop credentials in Supabase
    
    return { 
      status: 'pending_implementation',
      message: 'OAuth callback received',
      shop 
    };
  });
  
  // Customer signup - Create Loocbooc account
  fastify.post('/signup', async (request, reply) => {
    const { email, password, name } = request.body;
    
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required' });
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    
    if (error) {
      return reply.status(400).send({ error: error.message });
    }
    
    return { 
      success: true, 
      user: data.user,
      message: 'Account created. Check email for verification.'
    };
  });
  
  // Customer login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      return reply.status(401).send({ error: error.message });
    }
    
    return {
      success: true,
      user: data.user,
      session: data.session
    };
  });
  
  // Get current user
  fastify.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.slice(7);
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      return reply.status(401).send({ error: error.message });
    }
    
    return { user: data.user };
  });
  
  // Logout
  fastify.post('/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      await supabase.auth.signOut();
    }
    
    return { success: true };
  });
}
