/**
 * Embed Routes
 * Serves the try-on experience embedded in merchant storefronts
 */

import { supabase } from '../services/supabase.js';

export default async function embedRoutes(fastify) {
  
  // Serve embedded try-on page
  fastify.get('/embed/tryon', async (request, reply) => {
    const { product, shop } = request.query;
    
    // Generate the embedded try-on HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loocbooc Try-On</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #3d3129;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #6b5d4d;
    }
    .viewer {
      background: #fff;
      border-radius: 8px;
      height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      position: relative;
    }
    .viewer-placeholder {
      color: #8b7355;
      text-align: center;
    }
    .controls {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .size-btn {
      padding: 12px 24px;
      border: 1px solid #d9d5ce;
      background: #fff;
      color: #3d3129;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .size-btn:hover, .size-btn.active {
      background: #3d3129;
      color: #fff;
      border-color: #3d3129;
    }
    .cta {
      margin-top: 24px;
      text-align: center;
    }
    .cta-btn {
      padding: 16px 48px;
      background: #3d3129;
      color: #fff;
      border: none;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
    }
    .avatar-prompt {
      background: #fff;
      padding: 32px;
      text-align: center;
      border-radius: 8px;
    }
    .avatar-prompt h2 {
      font-size: 18px;
      margin-bottom: 12px;
      color: #3d3129;
    }
    .avatar-prompt p {
      font-size: 14px;
      color: #6b5d4d;
      margin-bottom: 24px;
    }
    .branding {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #8b7355;
    }
    .branding a {
      color: #3d3129;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">Virtual Try-On</div>
      <div class="subtitle">See how it looks on you</div>
    </div>
    
    <div id="app">
      <!-- Avatar creation or try-on view will render here -->
      <div class="avatar-prompt">
        <h2>Create Your Avatar</h2>
        <p>Enter your measurements to see how this garment fits your body.</p>
        <button class="cta-btn" onclick="showMeasurements()">Enter Measurements</button>
      </div>
    </div>
    
    <div class="branding">
      Powered by <a href="https://loocbooc.com" target="_blank">Loocbooc</a>
    </div>
  </div>
  
  <script>
    const PRODUCT_ID = '${product || ''}';
    const SHOP = '${shop || ''}';
    const API_BASE = '${process.env.SHOPIFY_APP_URL || 'https://api.loocbooc.com'}';
    
    // Check for existing avatar in localStorage
    const savedAvatar = localStorage.getItem('loocbooc_avatar');
    
    if (savedAvatar) {
      showTryOn(JSON.parse(savedAvatar));
    }
    
    function showMeasurements() {
      document.getElementById('app').innerHTML = \`
        <div style="background: #fff; padding: 24px; border-radius: 8px;">
          <h2 style="font-size: 18px; margin-bottom: 20px; color: #3d3129;">Your Measurements</h2>
          <form id="measurements-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <label style="display: block; font-size: 12px; font-weight: 600; color: #6b5d4d; margin-bottom: 6px;">HEIGHT (CM)</label>
                <input type="number" name="height" placeholder="165" required style="width: 100%; padding: 12px; border: 1px solid #d9d5ce; font-size: 16px;">
              </div>
              <div>
                <label style="display: block; font-size: 12px; font-weight: 600; color: #6b5d4d; margin-bottom: 6px;">BUST (CM)</label>
                <input type="number" name="bust" placeholder="90" required style="width: 100%; padding: 12px; border: 1px solid #d9d5ce; font-size: 16px;">
              </div>
              <div>
                <label style="display: block; font-size: 12px; font-weight: 600; color: #6b5d4d; margin-bottom: 6px;">WAIST (CM)</label>
                <input type="number" name="waist" placeholder="70" required style="width: 100%; padding: 12px; border: 1px solid #d9d5ce; font-size: 16px;">
              </div>
              <div>
                <label style="display: block; font-size: 12px; font-weight: 600; color: #6b5d4d; margin-bottom: 6px;">HIPS (CM)</label>
                <input type="number" name="hips" placeholder="95" required style="width: 100%; padding: 12px; border: 1px solid #d9d5ce; font-size: 16px;">
              </div>
            </div>
            <button type="submit" class="cta-btn" style="width: 100%; margin-top: 24px;">Create Avatar</button>
          </form>
        </div>
      \`;
      
      document.getElementById('measurements-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const measurements = {
          height: parseInt(form.get('height')),
          bust: parseInt(form.get('bust')),
          waist: parseInt(form.get('waist')),
          hips: parseInt(form.get('hips'))
        };
        
        localStorage.setItem('loocbooc_avatar', JSON.stringify({ measurements }));
        showTryOn({ measurements });
      };
    }
    
    function showTryOn(avatar) {
      document.getElementById('app').innerHTML = \`
        <div class="viewer">
          <div class="viewer-placeholder">
            <div style="font-size: 48px; margin-bottom: 16px;">👗</div>
            <div>3D Try-On Viewer</div>
            <div style="font-size: 12px; margin-top: 8px;">Height: \${avatar.measurements.height}cm | Bust: \${avatar.measurements.bust}cm</div>
          </div>
        </div>
        <div class="controls">
          <button class="size-btn" onclick="selectSize('XS')">XS</button>
          <button class="size-btn" onclick="selectSize('S')">S</button>
          <button class="size-btn active" onclick="selectSize('M')">M</button>
          <button class="size-btn" onclick="selectSize('L')">L</button>
          <button class="size-btn" onclick="selectSize('XL')">XL</button>
        </div>
        <div class="cta">
          <button class="cta-btn" onclick="addToCart()">Add to Cart</button>
        </div>
      \`;
    }
    
    function selectSize(size) {
      document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      console.log('Selected size:', size);
    }
    
    function addToCart() {
      // Post message to parent window to add to cart
      window.parent.postMessage({ type: 'loocbooc:add-to-cart', productId: PRODUCT_ID }, '*');
    }
  </script>
</body>
</html>
    `;
    
    reply.type('text/html').send(html);
  });
  
  // Serve embed CSS
  fastify.get('/embed.css', async (request, reply) => {
    const css = `
      .loocbooc-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
      }
      .loocbooc-modal {
        background: #fff;
        width: 90%;
        max-width: 900px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .loocbooc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e0d8;
      }
      .loocbooc-title {
        font-size: 16px;
        font-weight: 600;
        color: #3d3129;
      }
      .loocbooc-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b5d4d;
      }
      .loocbooc-body {
        flex: 1;
        overflow: hidden;
      }
      .loocbooc-iframe {
        width: 100%;
        height: 600px;
        border: none;
      }
    `;
    
    reply.type('text/css').send(css);
  });
}
