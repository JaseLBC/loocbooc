/**
 * Avatar Routes
 * - Create avatar from measurements
 * - Create avatar from photos (AI)
 * - Update avatar
 * - Get avatar for try-on
 */

import { supabase, isConfigured } from '../services/supabase.js';
import { memoryStore } from '../services/memory-store.js';
import { generateAvatarFromMeasurements, generateAvatarFromPhotos } from '../services/avatar-ai.js';
import { analyzeBodyType } from '../services/body-type.js';

// Use memory store in dev, Supabase in production
const useMemory = !isConfigured;

export default async function avatarRoutes(fastify) {
  
  // Get user's avatar
  fastify.get('/', async (request, reply) => {
    const userId = request.user?.id || 'dev-user';
    
    if (useMemory) {
      const avatar = await memoryStore.getAvatarByUserId(userId);
      return { avatar };
    }
    
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return reply.status(500).send({ error: error.message });
    }
    
    return { avatar: data || null };
  });
  
  // Create avatar from manual measurements
  fastify.post('/measurements', async (request, reply) => {
    const userId = request.user?.id || 'dev-user';
    
    const {
      height, weight, bust, waist, hips,
      inseam, shoulders, armLength, bodyType, gender
    } = request.body;
    
    if (!height || !bust || !waist || !hips) {
      return reply.status(400).send({ 
        error: 'Required measurements: height, bust, waist, hips' 
      });
    }
    
    const avatarModel = await generateAvatarFromMeasurements({
      height, weight, bust, waist, hips, inseam, shoulders, armLength, bodyType, gender
    });
    
    const avatarData = {
      source: 'measurements',
      measurements: { height, weight, bust, waist, hips, inseam, shoulders, armLength },
      body_type: bodyType,
      gender,
      model_url: avatarModel.url,
      model_data: avatarModel.data
    };
    
    if (useMemory) {
      // Check if avatar exists
      const existing = await memoryStore.getAvatarByUserId(userId);
      let avatar;
      if (existing) {
        avatar = await memoryStore.updateAvatar(existing.id, avatarData);
      } else {
        avatar = await memoryStore.createAvatar(userId, avatarData);
      }
      return { success: true, avatar, message: 'Avatar created from measurements' };
    }
    
    const { data, error } = await supabase
      .from('avatars')
      .upsert({
        user_id: userId,
        ...avatarData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    return { success: true, avatar: data, message: 'Avatar created from measurements' };
  });
  
  // Create/improve avatar from photos
  fastify.post('/photos', async (request, reply) => {
    const userId = request.user?.id || 'dev-user';
    
    const { frontPhoto, sidePhoto, existingMeasurements } = request.body;
    
    if (!frontPhoto || !sidePhoto) {
      return reply.status(400).send({ error: 'Both front and side photos required' });
    }
    
    const avatarResult = await generateAvatarFromPhotos({
      frontPhoto, sidePhoto, existingMeasurements
    });
    
    const avatarData = {
      source: 'photos',
      measurements: avatarResult.measurements,
      body_type: avatarResult.bodyType,
      gender: avatarResult.gender,
      model_url: avatarResult.url,
      model_data: avatarResult.data,
      confidence_score: avatarResult.confidence
    };
    
    if (useMemory) {
      const existing = await memoryStore.getAvatarByUserId(userId);
      let avatar;
      if (existing) {
        avatar = await memoryStore.updateAvatar(existing.id, avatarData);
      } else {
        avatar = await memoryStore.createAvatar(userId, avatarData);
      }
      return { success: true, avatar, confidence: avatarResult.confidence, message: 'Avatar created from photos' };
    }
    
    const { data, error } = await supabase
      .from('avatars')
      .upsert({
        user_id: userId,
        ...avatarData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    return { success: true, avatar: data, confidence: avatarResult.confidence, message: 'Avatar created from photos' };
  });
  
  // Update avatar measurements
  fastify.patch('/', async (request, reply) => {
    const userId = request.user?.id || 'dev-user';
    const updates = request.body;
    
    let modelUpdate = {};
    if (updates.measurements) {
      const avatarModel = await generateAvatarFromMeasurements(updates.measurements);
      modelUpdate = { model_url: avatarModel.url, model_data: avatarModel.data };
    }
    
    if (useMemory) {
      const existing = await memoryStore.getAvatarByUserId(userId);
      if (!existing) {
        return reply.status(404).send({ error: 'Avatar not found' });
      }
      const avatar = await memoryStore.updateAvatar(existing.id, { ...updates, ...modelUpdate });
      return { success: true, avatar };
    }
    
    const { data, error } = await supabase
      .from('avatars')
      .update({ ...updates, ...modelUpdate, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    return { success: true, avatar: data };
  });
  
  // Delete avatar
  fastify.delete('/', async (request, reply) => {
    const userId = request.user?.id || 'dev-user';
    
    if (useMemory) {
      const existing = await memoryStore.getAvatarByUserId(userId);
      if (existing) {
        await memoryStore.deleteAvatar(existing.id);
      }
      return { success: true, message: 'Avatar deleted' };
    }
    
    const { error } = await supabase
      .from('avatars')
      .delete()
      .eq('user_id', userId);
    
    if (error) {
      return reply.status(500).send({ error: error.message });
    }
    
    return { success: true, message: 'Avatar deleted' };
  });
  
  // Analyze body type from measurements
  fastify.post('/body-type', async (request, reply) => {
    const { bust, waist, hips } = request.body;
    
    if (!bust || !waist || !hips) {
      return reply.status(400).send({ error: 'bust, waist, and hips measurements required' });
    }
    
    const analysis = analyzeBodyType({ bust, waist, hips });
    
    return {
      bodyType: analysis.type,
      confidence: analysis.confidence,
      description: analysis.description,
      flattering: analysis.flattering,
      avoid: analysis.avoid,
      ratios: analysis.ratios
    };
  });
}
