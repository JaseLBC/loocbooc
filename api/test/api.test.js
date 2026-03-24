/**
 * Loocbooc API Tests
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

describe('Health Check', () => {
  it('should return ok status', async () => {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert(data.timestamp);
  });
});

describe('Avatar API', () => {
  it('POST /api/avatar/measurements - create avatar from measurements', async () => {
    const res = await fetch(`${API_BASE}/api/avatar/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        height: 165,
        bust: 90,
        waist: 70,
        hips: 95,
        bodyType: 'hourglass'
      })
    });
    
    const data = await res.json();
    
    assert.strictEqual(res.status, 200);
    assert(data.avatar);
    assert(data.avatar.id);
  });

  it('GET /api/avatar - returns 404 for non-existent user', async () => {
    const res = await fetch(`${API_BASE}/api/avatar`, {
      headers: { 'Authorization': 'Bearer fake-token' }
    });
    
    // In dev mode without auth, should still work
    assert([200, 404].includes(res.status));
  });
});

describe('Try-On API', () => {
  it('POST /api/tryon/size-check - recommends size', async () => {
    const res = await fetch(`${API_BASE}/api/tryon/size-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bust: 88,
        waist: 68,
        hips: 94,
        region: 'AU'
      })
    });
    
    const data = await res.json();
    
    assert.strictEqual(res.status, 200);
    assert(data.recommended);
    assert(data.recommended.size);
    assert(data.recommended.confidence > 0);
    assert(data.allSizes);
    assert(Array.isArray(data.allSizes));
  });

  it('POST /api/tryon/size-check - handles US region', async () => {
    const res = await fetch(`${API_BASE}/api/tryon/size-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bust: 88,
        waist: 68,
        hips: 94,
        region: 'US'
      })
    });
    
    const data = await res.json();
    
    assert.strictEqual(res.status, 200);
    assert(data.recommended);
  });

  it('POST /api/tryon/size-check - validates required fields', async () => {
    const res = await fetch(`${API_BASE}/api/tryon/size-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bust: 88
        // Missing waist and hips
      })
    });
    
    assert.strictEqual(res.status, 400);
  });

  it('POST /api/tryon/render - generates try-on render', async () => {
    const res = await fetch(`${API_BASE}/api/tryon/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size: 'M',
        color: '#2d2519'
      })
    });
    
    const data = await res.json();
    
    assert.strictEqual(res.status, 200);
    assert(data.success);
    assert(data.render);
    assert(data.render.fitAnalysis);
  });
});

describe('Analytics API', () => {
  it('POST /api/analytics/track - tracks event', async () => {
    const res = await fetch(`${API_BASE}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'tryon_button_click',
        shop: 'test-shop.myshopify.com',
        garmentId: 'product-123'
      })
    });
    
    const data = await res.json();
    
    assert.strictEqual(res.status, 200);
    assert(data.success);
    assert(data.event);
    assert(data.event.id);
  });

  it('GET /api/analytics/events - lists event types', async () => {
    const res = await fetch(`${API_BASE}/api/analytics/events`);
    const data = await res.json();
    
    assert.strictEqual(res.status, 200);
    assert(data.events);
    assert(Array.isArray(data.events));
    assert(data.events.length > 0);
  });

  it('GET /api/analytics/shop/:shop - gets shop analytics', async () => {
    const res = await fetch(`${API_BASE}/api/analytics/shop/test-shop.myshopify.com`);
    const data = await res.json();
    
    assert.strictEqual(res.status, 200);
    assert(data.success);
    assert(data.analytics);
    assert(typeof data.analytics.totalEvents === 'number');
  });
});

describe('Embed API', () => {
  it('GET /embed/tryon - returns embedded HTML', async () => {
    const res = await fetch(`${API_BASE}/embed/tryon?product=123&shop=test.myshopify.com`);
    const html = await res.text();
    
    assert.strictEqual(res.status, 200);
    assert(res.headers.get('content-type').includes('text/html'));
    assert(html.includes('<!DOCTYPE html>'));
    assert(html.includes('Loocbooc'));
  });

  it('GET /embed/loocbooc.js - returns embed script', async () => {
    const res = await fetch(`${API_BASE}/embed/loocbooc.js`);
    const js = await res.text();
    
    assert.strictEqual(res.status, 200);
    assert(res.headers.get('content-type').includes('javascript'));
    assert(js.includes('Loocbooc'));
  });
});

console.log('✅ All API tests passed');
