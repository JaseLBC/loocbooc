/**
 * Loocbooc - Virtual Try-On
 * Main entry point and exports
 */

export { TryOnViewer } from './components/TryOnViewer';
export { TryOnModal } from './components/TryOnModal';
export { AvatarCreator } from './components/AvatarCreator';
export { ComparisonView } from './components/ComparisonView';

// Shopify theme integration helper
export function initLoocbooc(config = {}) {
  const { 
    apiBaseUrl = 'https://api.loocbooc.com',
    shopDomain,
    onReady 
  } = config;
  
  console.log('🚀 Loocbooc initialized', { apiBaseUrl, shopDomain });
  
  // Find all try-on buttons and attach handlers
  document.querySelectorAll('[data-loocbooc-tryon]').forEach(button => {
    const productId = button.dataset.productId;
    
    button.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('loocbooc:open', { 
        detail: { productId } 
      }));
    });
  });
  
  onReady?.();
  
  return {
    openTryOn: (productId) => {
      window.dispatchEvent(new CustomEvent('loocbooc:open', { 
        detail: { productId } 
      }));
    },
    closeTryOn: () => {
      window.dispatchEvent(new CustomEvent('loocbooc:close'));
    }
  };
}

// Auto-init for script tag usage
if (typeof window !== 'undefined') {
  window.Loocbooc = {
    init: initLoocbooc,
    TryOnViewer,
    TryOnModal,
    AvatarCreator,
    ComparisonView
  };
}
