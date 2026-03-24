/**
 * Embed Routes
 * - Serves embedded try-on interface for Shopify storefronts
 */

export default async function embedRoutes(fastify) {
  
  // Embedded try-on page (loaded in iframe)
  fastify.get('/embed/tryon', async (request, reply) => {
    const { product, shop } = request.query;
    
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
      display: flex;
      flex-direction: column;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
      flex: 1;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #8b7355;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #3d3129;
      margin-top: 8px;
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
      overflow: hidden;
    }
    .viewer-placeholder {
      color: #8b7355;
      text-align: center;
    }
    .viewer-placeholder svg {
      width: 80px;
      height: 80px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    .form-group {
      margin-bottom: 16px;
    }
    .label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b5d4d;
      margin-bottom: 6px;
    }
    .input {
      width: 100%;
      padding: 12px;
      border: 1px solid #d9d5ce;
      font-size: 16px;
      font-family: inherit;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .button {
      width: 100%;
      padding: 16px;
      background: #3d3129;
      color: #e5e0d8;
      border: none;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      margin-top: 8px;
    }
    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .fit-card {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-top: 24px;
    }
    .fit-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
      color: #3d3129;
    }
    .fit-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-top: 1px solid #e5e0d8;
    }
    .fit-score {
      display: inline-block;
      width: 60px;
      height: 6px;
      background: #e5e0d8;
      border-radius: 3px;
      overflow: hidden;
      margin-right: 8px;
      vertical-align: middle;
    }
    .fit-bar {
      height: 100%;
      background: #4a6b4a;
      border-radius: 3px;
    }
    .recommendation {
      margin-top: 16px;
      padding: 12px;
      background: #e5e0d8;
    }
    .footer {
      text-align: center;
      padding: 16px;
      font-size: 12px;
      color: #8b7355;
    }
    .loading {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    .loading.active {
      display: block;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e0d8;
      border-top-color: #3d3129;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">LOOCBOOC</div>
      <h1 class="title">Virtual Try-On</h1>
    </div>
    
    <div class="viewer" id="viewer">
      <div class="viewer-placeholder" id="placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <p>Enter your measurements to see how this looks on you</p>
      </div>
      <div class="loading" id="loading">
        <div class="spinner"></div>
      </div>
    </div>
    
    <form id="form">
      <div class="row">
        <div class="form-group">
          <label class="label">Height (cm) *</label>
          <input type="number" class="input" name="height" placeholder="165" required>
        </div>
        <div class="form-group">
          <label class="label">Weight (kg)</label>
          <input type="number" class="input" name="weight" placeholder="60">
        </div>
      </div>
      <div class="row">
        <div class="form-group">
          <label class="label">Bust (cm) *</label>
          <input type="number" class="input" name="bust" placeholder="90" required>
        </div>
        <div class="form-group">
          <label class="label">Waist (cm) *</label>
          <input type="number" class="input" name="waist" placeholder="70" required>
        </div>
      </div>
      <div class="row">
        <div class="form-group">
          <label class="label">Hips (cm) *</label>
          <input type="number" class="input" name="hips" placeholder="95" required>
        </div>
        <div class="form-group">
          <label class="label">Size to try</label>
          <select class="input" name="size">
            <option value="XS">XS</option>
            <option value="S">S</option>
            <option value="M" selected>M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
          </select>
        </div>
      </div>
      <button type="submit" class="button" id="submit">Try It On</button>
    </form>
    
    <div class="fit-card" id="fitCard" style="display: none;">
      <div class="fit-title">Fit Analysis</div>
      <div id="fitResults"></div>
      <div class="recommendation" id="recommendation"></div>
    </div>
  </div>
  
  <div class="footer">
    Powered by <strong>Loocbooc</strong> — Your avatar works everywhere
  </div>
  
  <script>
    const API_BASE = window.location.origin;
    const productId = '${product || ''}';
    const shopDomain = '${shop || ''}';
    
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const form = e.target;
      const data = {
        height: parseFloat(form.height.value),
        weight: parseFloat(form.weight.value) || null,
        bust: parseFloat(form.bust.value),
        waist: parseFloat(form.waist.value),
        hips: parseFloat(form.hips.value)
      };
      const size = form.size.value;
      
      // Show loading
      document.getElementById('loading').classList.add('active');
      document.getElementById('placeholder').style.display = 'none';
      document.getElementById('submit').disabled = true;
      
      try {
        // Create avatar
        const avatarRes = await fetch(API_BASE + '/api/avatar/measurements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const avatarData = await avatarRes.json();
        
        // Generate try-on
        const tryonRes = await fetch(API_BASE + '/api/tryon/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatarId: avatarData.avatar?.id,
            size
          })
        });
        const tryonData = await tryonRes.json();
        
        // Show fit analysis
        if (tryonData.render?.fitAnalysis) {
          showFitAnalysis(tryonData.render.fitAnalysis);
        }
        
        // Update viewer placeholder with success message
        document.getElementById('placeholder').innerHTML = \`
          <svg viewBox="0 0 24 24" fill="none" stroke="#4a6b4a" stroke-width="1.5" style="width: 60px; height: 60px;">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <p style="color: #4a6b4a; font-weight: 600;">Avatar created!</p>
          <p style="margin-top: 8px; font-size: 13px;">3D viewer coming soon</p>
        \`;
        document.getElementById('placeholder').style.display = 'block';
        
      } catch (err) {
        console.error('Error:', err);
        alert('Something went wrong. Please try again.');
      } finally {
        document.getElementById('loading').classList.remove('active');
        document.getElementById('submit').disabled = false;
      }
    });
    
    function showFitAnalysis(analysis) {
      const fitCard = document.getElementById('fitCard');
      const fitResults = document.getElementById('fitResults');
      const recommendation = document.getElementById('recommendation');
      
      let resultsHtml = '';
      for (const [area, data] of Object.entries(analysis.areas)) {
        const areaName = area.charAt(0).toUpperCase() + area.slice(1);
        const barWidth = (data.score * 100) + '%';
        const barColor = data.score >= 0.8 ? '#4a6b4a' : data.score >= 0.6 ? '#8b7355' : '#8b4444';
        resultsHtml += \`
          <div class="fit-row">
            <span>\${areaName}</span>
            <span>
              <span class="fit-score"><span class="fit-bar" style="width: \${barWidth}; background: \${barColor}"></span></span>
              \${data.description}
            </span>
          </div>
        \`;
      }
      fitResults.innerHTML = resultsHtml;
      
      if (analysis.recommendation) {
        recommendation.innerHTML = \`
          <strong>Recommended: \${analysis.recommendation.size}</strong><br>
          \${analysis.recommendation.message}
        \`;
      }
      
      fitCard.style.display = 'block';
    }
  </script>
</body>
</html>
    `;
    
    reply.type('text/html').send(html);
  });
  
  // Embed script for storefronts
  fastify.get('/embed/loocbooc.js', async (request, reply) => {
    const js = `
(function() {
  'use strict';
  
  const LOOCBOOC_API = '${process.env.LOOCBOOC_API_URL || 'https://api.loocbooc.com'}';
  
  function init() {
    console.log('🚀 Loocbooc embed loaded');
    
    document.querySelectorAll('[data-loocbooc-tryon]').forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        const productId = this.dataset.productId;
        openModal(productId);
      });
    });
  }
  
  function openModal(productId) {
    const overlay = document.createElement('div');
    overlay.id = 'loocbooc-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center';
    overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;width:90%;max-width:800px;max-height:90vh;overflow:auto;position:relative';
    
    const iframe = document.createElement('iframe');
    iframe.src = LOOCBOOC_API + '/embed/tryon?product=' + productId + '&shop=' + (window.Shopify?.shop || '');
    iframe.style.cssText = 'width:100%;height:80vh;border:none';
    
    modal.appendChild(iframe);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }
  
  function closeModal() {
    const overlay = document.getElementById('loocbooc-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  }
  
  window.Loocbooc = { init, openModal, closeModal };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
    `;
    
    reply.type('application/javascript').send(js);
  });
}
