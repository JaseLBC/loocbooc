/**
 * Loocbooc Embed Script
 * Loads the try-on modal on Shopify storefronts
 */

(function() {
  'use strict';
  
  const LOOCBOOC_API = 'https://api.loocbooc.com';
  const LOOCBOOC_CDN = 'https://cdn.loocbooc.com';
  
  // State
  let isInitialized = false;
  let currentUser = null;
  let currentAvatar = null;
  let modalContainer = null;
  
  // Initialize Loocbooc
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('🚀 Loocbooc initializing...');
    
    // Create modal container
    modalContainer = document.createElement('div');
    modalContainer.id = 'loocbooc-modal-root';
    document.body.appendChild(modalContainer);
    
    // Load styles
    loadStyles();
    
    // Check for existing session
    checkSession();
    
    // Listen for events
    window.addEventListener('loocbooc:open', handleOpen);
    window.addEventListener('loocbooc:close', handleClose);
    
    // Attach click handlers to try-on buttons
    attachButtonHandlers();
    
    console.log('✅ Loocbooc ready');
  }
  
  // Load CSS
  function loadStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LOOCBOOC_CDN + '/embed.css';
    document.head.appendChild(link);
  }
  
  // Check for existing Loocbooc session
  async function checkSession() {
    const token = localStorage.getItem('loocbooc_token');
    if (!token) return;
    
    try {
      const res = await fetch(LOOCBOOC_API + '/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        currentUser = { ...data.user, token };
        
        // Fetch avatar
        const avatarRes = await fetch(LOOCBOOC_API + '/api/avatar', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (avatarRes.ok) {
          const avatarData = await avatarRes.json();
          currentAvatar = avatarData.avatar;
        }
      }
    } catch (err) {
      console.warn('Loocbooc session check failed:', err);
    }
  }
  
  // Attach handlers to all try-on buttons
  function attachButtonHandlers() {
    document.querySelectorAll('[data-loocbooc-tryon]').forEach(button => {
      if (button.dataset.loocboocAttached) return;
      button.dataset.loocboocAttached = 'true';
      
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        const productId = button.dataset.productId;
        const productTitle = button.dataset.productTitle;
        const productImages = JSON.parse(button.dataset.productImages || '[]');
        const productVariants = JSON.parse(button.dataset.productVariants || '[]');
        
        openTryOn({
          id: productId,
          title: productTitle,
          images: productImages,
          variants: productVariants
        });
      });
    });
  }
  
  // Handle open event
  function handleOpen(event) {
    const { productId } = event.detail;
    
    // Find product data from button or fetch from API
    const button = document.querySelector(`[data-loocbooc-tryon][data-product-id="${productId}"]`);
    
    if (button) {
      const product = {
        id: productId,
        title: button.dataset.productTitle,
        images: JSON.parse(button.dataset.productImages || '[]'),
        variants: JSON.parse(button.dataset.productVariants || '[]')
      };
      openTryOn(product);
    }
  }
  
  // Handle close event
  function handleClose() {
    closeTryOn();
  }
  
  // Open try-on modal
  function openTryOn(product) {
    // Render React component into modal container
    // For MVP, we'll use a simple iframe approach
    // Production: render React directly
    
    modalContainer.innerHTML = `
      <div class="loocbooc-overlay" onclick="window.Loocbooc.close()">
        <div class="loocbooc-modal" onclick="event.stopPropagation()">
          <div class="loocbooc-header">
            <span class="loocbooc-title">Virtual Try-On</span>
            <button class="loocbooc-close" onclick="window.Loocbooc.close()">×</button>
          </div>
          <div class="loocbooc-body">
            <iframe 
              src="${LOOCBOOC_API}/embed/tryon?product=${product.id}&shop=${window.Shopify?.shop || ''}"
              frameborder="0"
              class="loocbooc-iframe"
            ></iframe>
          </div>
        </div>
      </div>
    `;
    
    document.body.style.overflow = 'hidden';
  }
  
  // Close try-on modal
  function closeTryOn() {
    modalContainer.innerHTML = '';
    document.body.style.overflow = '';
  }
  
  // Public API
  window.Loocbooc = {
    init,
    open: openTryOn,
    close: closeTryOn,
    getUser: () => currentUser,
    getAvatar: () => currentAvatar
  };
  
  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Re-attach handlers on dynamic content (for SPAs)
  const observer = new MutationObserver(() => {
    attachButtonHandlers();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
})();
