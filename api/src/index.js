import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

// Routes
import authRoutes from './routes/auth.js';
import avatarRoutes from './routes/avatar.js';
import garmentRoutes from './routes/garment.js';
import tryonRoutes from './routes/tryon.js';
import embedRoutes from './routes/embed.js';
import analyticsRoutes from './routes/analytics.js';

const fastify = Fastify({
  logger: true
});

// Plugins
await fastify.register(cors, {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://loocbooc.com', /\.myshopify\.com$/]
    : true,
  credentials: true
});

await fastify.register(cookie);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API Routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(avatarRoutes, { prefix: '/api/avatar' });
fastify.register(garmentRoutes, { prefix: '/api/garment' });
fastify.register(tryonRoutes, { prefix: '/api/tryon' });
fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
fastify.register(embedRoutes); // Embed routes at root for /embed/* paths

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Loocbooc API running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
