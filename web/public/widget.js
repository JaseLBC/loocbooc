/**
 * Loocbooc Widget
 * Drop-in try-on button for any Shopify store
 * 
 * Usage: Add to theme.liquid before </body>:
 * <script src="https://cdn.loocbooc.com/widget.js" data-shop="your-store.myshopify.com"></script>
 */

(function() {
  'use strict';
  
  // Configuration
  const LOOCBOOC_API = window.LOOCBOOC_API || 'https://api.loocbooc.com';
  const LOOCBOOC_CDN = window.LOOCBOOC_CDN || 'https://cdn.loocbooc.com';
  
  // Get shop from script tag
  const scriptTag = document.currentScript;
  const shop = scriptTag?.dataset?.shop || window.Shopify?.shop;
  
  if (!shop) {
    console.warn('Loocbooc: Could not detect shop. Add data-shop attribute.');
    return;
  }
  
  // State
  let avatar = null;
  let modalOpen = false;
  
  // Load saved avatar from localStorage
  try {
    const saved = localStorage.getItem('loocbooc_avatar');
    if (saved) avatar = JSON.parse(saved);
  } catch (e) {}
  
  // Inject styles
  const styles = document.createElement('style');
  styles.textContent = `
    .loocbooc-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: #3d3129;
      color: #fff;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      margin: 8px 0;
    }
    .loocbooc-btn:hover {
      opacity: 0.9;
    }
    .loocbooc-btn svg {
      width: 18px;
      height: 18px;
    }
    .loocbooc-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.75);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .loocbooc-modal {
      background: #fff;
      width: 100%;
      max-width: 900px;
      max-height: 90vh;
      overflow: auto;
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
      font-size: 28px;
      cursor: pointer;
      color: #6b5d4d;
      line-height: 1;
    }
    .loocbooc-body {
      padding: 0;
    }
    .loocbooc-iframe {
      width: 100%;
      height: 600px;
      border: none;
    }
    .loocbooc-branding {
      padding: 12px 20px;
      text-align: center;
      font-size: 12px;
      color: #8b7355;
      border-top: 1px solid #e5e0d8;
    }
    .loocbooc-branding a {
      color: #3d3129;
      text-decoration: none;
      font-weight: 600;
    }
  `;
  document.head.appendChild(styles);
  
  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.id = 'loocbooc-modal';
  document.body.appendChild(modalContainer);
  
  // Track event
  function track(eventType, data = {}) {
    fetch(`${LOOCBOOC_API}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        shop,
        ...data
      })
    }).catch(() => {});
  }
  
  // Open modal
  function openModal(productId) {
    if (modalOpen) return;
    modalOpen = true;
    
    track('tryon_modal_open', { garmentId: productId });
    
    modalContainer.innerHTML = `
      <div class="loocbooc-overlay" onclick="window.Loocbooc.close()">
        <div class="loocbooc-modal" onclick="event.stopPropagation()">
          <div class="loocbooc-header">
            <span class="loocbooc-title">Virtual Try-On</span>
            <button class="loocbooc-close" onclick="window.Loocbooc.close()">&times;</button>
          </div>
          <div class="loocbooc-body">
            <iframe 
              class="loocbooc-iframe"
              src="${LOOCBOOC_API}/embed/tryon?product=${productId}&shop=${shop}"
            ></iframe>
          </div>
          <div class="loocbooc-branding">
            Powered by <a href="https://loocbooc.com" target="_blank">Loocbooc</a> — Your avatar works everywhere
          </div>
        </div>
      </div>
    `;
    
    document.body.style.overflow = 'hidden';
  }
  
  // Close modal
  function closeModal() {
    modalOpen = false;
    modalContainer.innerHTML = '';
    document.body.style.overflow = '';
    track('tryon_modal_close');
  }
  
  // Get current product ID
  function getProductId() {
    // Try meta tag
    const meta = document.querySelector('meta[property="og:id"]');
    if (meta) return meta.content;
    
    // Try Shopify global
    if (window.ShopifyAnalytics?.meta?.product?.id) {
      return window.ShopifyAnalytics.meta.product.id;
    }
    
    // Try URL
    const match = window.location.pathname.match(/\/products\/([^\/\?]+)/);
    if (match) return match[1];
    
    return null;
  }
  
  // Inject try-on button
  function injectButton() {
    // Find add to cart form
    const form = document.querySelector('form[action*="/cart/add"]');
    if (!form) return;
    
    // Check if button already exists
    if (form.querySelector('.loocbooc-btn')) return;
    
    const productId = getProductId();
    if (!productId) return;
    
    // Create button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loocbooc-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      Try On Your Avatar
    `;
    
    btn.onclick = (e) => {
      e.preventDefault();
      track('tryon_button_click', { garmentId: productId });
      openModal(productId);
    };
    
    // Insert before add to cart button
    const addToCartBtn = form.querySelector('[type="submit"], .add-to-cart, .product-form__submit');
    if (addToCartBtn) {
      addToCartBtn.parentNode.insertBefore(btn, addToCartBtn);
    } else {
      form.appendChild(btn);
    }
  }
  
  // Initialize
  function init() {
    injectButton();
    
    // Re-inject on dynamic page changes (for SPAs)
    const observer = new MutationObserver(() => {
      injectButton();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('✨ Loocbooc initialized for', shop);
  }
  
  // Public API
  window.Loocbooc = {
    open: openModal,
    close: closeModal,
    track,
    getAvatar: () => avatar,
    setAvatar: (a) => {
      avatar = a;
      localStorage.setItem('loocbooc_avatar', JSON.stringify(a));
    }
  };
  
  // Listen for messages from iframe
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'loocbooc:add-to-cart') {
      closeModal();
      // Trigger add to cart
      const form = document.querySelector('form[action*="/cart/add"]');
      if (form) form.submit();
    }
    
    if (event.data?.type === 'loocbooc:avatar-created') {
      window.Loocbooc.setAvatar(event.data.avatar);
    }
  });
  
  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
