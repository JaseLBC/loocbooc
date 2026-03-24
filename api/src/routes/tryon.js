/**
 * Try-On Routes
 * - Generate try-on render (avatar + garment)
 * - Get comparison view
 */

import { supabase, isConfigured } from '../services/supabase.js';
import { memoryStore } from '../services/memory-store.js';
import { renderTryOn } from '../services/tryon-renderer.js';
import { getBestSize, recommendSizes } from '../services/size-engine.js';

const useMemory = !isConfigured;

export default async function tryonRoutes(fastify) {
  
  // Generate try-on render
  fastify.post('/render', async (request, reply) => {
    const { avatarId, garmentId, size, color } = request.body;
    const userId = request.user?.id || 'dev-user';
    
    // For dev, we can render without stored data
    // Just use the provided avatar/garment data or fetch from memory
    
    let avatar, garment;
    
    if (useMemory) {
      // In dev mode, get avatar by user ID if no avatarId provided
      if (avatarId) {
        avatar = { id: avatarId, model_data: null, measurements: {} };
      } else {
        avatar = await memoryStore.getAvatarByUserId(userId);
      }
      
      if (garmentId) {
        garment = await memoryStore.getGarment(garmentId);
      }
      
      // Generate render even without stored data (for demo)
      const render = await renderTryOn({
        avatar: avatar?.model_data || { measurements: avatar?.measurements || { height: 165, bust: 90, waist: 70, hips: 95 } },
        garment: garment?.model_data || {},
        size: size || 'M',
        color
      });
      
      return {
        success: true,
        render: {
          id: `render-${Date.now()}`,
          url: render.url,
          data: render.data,
          fitAnalysis: render.fitAnalysis
        }
      };
    }
    
    if (!avatarId || !garmentId) {
      return reply.status(400).send({ error: 'avatarId and garmentId required' });
    }
    
    // Fetch avatar
    const { data: avatarData, error: avatarError } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single();
    
    if (avatarError || !avatarData) {
      return reply.status(404).send({ error: 'Avatar not found' });
    }
    
    // Fetch garment
    const { data: garmentData, error: garmentError } = await supabase
      .from('garments')
      .select('*')
      .eq('id', garmentId)
      .single();
    
    if (garmentError || !garmentData) {
      return reply.status(404).send({ error: 'Garment not found' });
    }
    
    // Generate the try-on render
    const render = await renderTryOn({
      avatar: avatarData.model_data,
      garment: garmentData.model_data,
      size,
      color
    });
    
    // Cache the render
    const { data: cached } = await supabase
      .from('tryon_renders')
      .upsert({
        avatar_id: avatarId,
        garment_id: garmentId,
        size,
        color,
        render_url: render.url,
        render_data: render.data,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'avatar_id,garment_id,size,color'
      })
      .select()
      .single();
    
    return {
      success: true,
      render: {
        id: cached?.id,
        url: render.url,
        data: render.data,
        fitAnalysis: render.fitAnalysis
      }
    };
  });
  
  // Get cached render (if exists)
  fastify.get('/render/:avatarId/:garmentId', async (request, reply) => {
    const { avatarId, garmentId } = request.params;
    const { size, color } = request.query;
    
    if (useMemory) {
      const render = await memoryStore.getRender(avatarId, garmentId, size, color);
      if (!render) {
        return reply.status(404).send({ 
          error: 'Render not found',
          message: 'Call POST /api/tryon/render to generate'
        });
      }
      return { render };
    }
    
    let query = supabase
      .from('tryon_renders')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('garment_id', garmentId);
    
    if (size) query = query.eq('size', size);
    if (color) query = query.eq('color', color);
    
    const { data, error } = await query.single();
    
    if (error && error.code !== 'PGRST116') {
      return reply.status(500).send({ error: error.message });
    }
    
    if (!data) {
      return reply.status(404).send({ 
        error: 'Render not found',
        message: 'Call POST /api/tryon/render to generate'
      });
    }
    
    return { render: data };
  });
  
  // Get fit recommendation
  fastify.get('/fit/:avatarId/:garmentId', async (request, reply) => {
    const { avatarId, garmentId } = request.params;
    const { region = 'AU' } = request.query;
    
    let avatar, garment;
    
    if (useMemory) {
      avatar = await memoryStore.getAvatarByUserId(avatarId);
      garment = await memoryStore.getGarment(garmentId);
      
      // Use demo measurements if not found
      const measurements = avatar?.measurements || { bust: 90, waist: 70, hips: 95 };
      const sizeChart = garment?.size_chart || null;
      
      const recommendation = getBestSize(measurements, sizeChart, region);
      
      return {
        fit: recommendation,
        allSizes: recommendSizes(measurements, sizeChart, region)
      };
    }
    
    // Fetch avatar measurements
    const { data: avatarData } = await supabase
      .from('avatars')
      .select('measurements, body_type')
      .eq('id', avatarId)
      .single();
    
    // Fetch garment size chart
    const { data: garmentData } = await supabase
      .from('garments')
      .select('variants, size_chart')
      .eq('id', garmentId)
      .single();
    
    if (!avatarData || !garmentData) {
      return reply.status(404).send({ error: 'Avatar or garment not found' });
    }
    
    const recommendation = getBestSize(
      avatarData.measurements, 
      garmentData.size_chart,
      region
    );
    
    return { 
      fit: recommendation,
      allSizes: recommendSizes(avatarData.measurements, garmentData.size_chart, region)
    };
  });
  
  // Quick size check (no auth required, just measurements)
  fastify.post('/size-check', async (request, reply) => {
    const { bust, waist, hips, sizeChart, region = 'AU' } = request.body;
    
    if (!bust || !waist || !hips) {
      return reply.status(400).send({ error: 'bust, waist, and hips measurements required' });
    }
    
    const measurements = { bust, waist, hips };
    const recommendation = getBestSize(measurements, sizeChart, region);
    
    return {
      recommended: recommendation,
      allSizes: recommendSizes(measurements, sizeChart, region)
    };
  });
}
