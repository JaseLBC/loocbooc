/**
 * Demo Page - Simulates a Shopify product page with Loocbooc
 * Use for testing and investor demos
 */

import React, { useState } from 'react';
import { TryOnModal } from '../components/TryOnModal';
import { SizeComparison } from '../components/SizeComparison';

// Demo product (Charcoal-style)
const DEMO_PRODUCT = {
  id: 'charcoal-linen-midi',
  title: 'Linen Midi Dress',
  subtitle: 'Coal',
  price: '$189.00',
  images: [
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=900&fit=crop',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=900&fit=crop',
    'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=900&fit=crop'
  ],
  description: 'A timeless midi dress crafted from premium European linen. Features a relaxed fit through the body with a defined waist and elegant A-line skirt. Perfect for warm days and effortless dressing.',
  details: [
    '100% European Linen',
    'Relaxed fit',
    'Side zip closure',
    'Midi length',
    'Made in Australia'
  ],
  variants: [
    { id: 'v1', option1: 'XS', title: 'XS', available: true },
    { id: 'v2', option1: 'S', title: 'S', available: true },
    { id: 'v3', option1: 'M', title: 'M', available: true },
    { id: 'v4', option1: 'L', title: 'L', available: true },
    { id: 'v5', option1: 'XL', title: 'XL', available: false }
  ],
  sizeChart: {
    'XS': { bust: [80, 84], waist: [60, 64], hips: [86, 90] },
    'S': { bust: [84, 88], waist: [64, 68], hips: [90, 94] },
    'M': { bust: [88, 92], waist: [68, 72], hips: [94, 98] },
    'L': { bust: [92, 96], waist: [72, 76], hips: [98, 102] },
    'XL': { bust: [96, 100], waist: [76, 80], hips: [102, 106] }
  }
};

export function DemoPage() {
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [showTryOn, setShowTryOn] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [recommendedSize, setRecommendedSize] = useState(null);

  const handleAvatarCreated = (newAvatar) => {
    setAvatar(newAvatar);
    // Get size recommendation
    if (newAvatar?.measurements) {
      fetch('/api/tryon/size-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAvatar.measurements,
          sizeChart: DEMO_PRODUCT.sizeChart
        })
      })
        .then(r => r.json())
        .then(data => {
          if (data.recommended) {
            setRecommendedSize(data.recommended.size);
            setSelectedSize(data.recommended.size);
          }
        })
        .catch(console.error);
    }
  };

  const styles = {
    page: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: '#fff',
      minHeight: '100vh'
    },
    header: {
      padding: '20px 40px',
      borderBottom: '1px solid #e5e0d8',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    logo: {
      fontSize: '18px',
      fontWeight: '700',
      letterSpacing: '3px',
      color: '#3d3129'
    },
    nav: {
      display: 'flex',
      gap: '32px',
      fontSize: '13px',
      letterSpacing: '1px'
    },
    navLink: {
      color: '#3d3129',
      textDecoration: 'none'
    },
    container: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '40px'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '60px'
    },
    gallery: {
      display: 'flex',
      gap: '16px'
    },
    thumbs: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    thumb: (active) => ({
      width: '80px',
      height: '100px',
      objectFit: 'cover',
      cursor: 'pointer',
      border: active ? '2px solid #3d3129' : '2px solid transparent',
      opacity: active ? 1 : 0.6
    }),
    mainImage: {
      flex: 1,
      aspectRatio: '3/4',
      objectFit: 'cover',
      background: '#f5f5f5'
    },
    productInfo: {
      paddingTop: '20px'
    },
    breadcrumb: {
      fontSize: '12px',
      color: '#8b7355',
      marginBottom: '16px',
      letterSpacing: '1px'
    },
    title: {
      fontSize: '28px',
      fontWeight: '600',
      color: '#3d3129',
      marginBottom: '4px'
    },
    subtitle: {
      fontSize: '16px',
      color: '#6b5d4d',
      marginBottom: '16px'
    },
    price: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#3d3129',
      marginBottom: '24px'
    },
    sizeSection: {
      marginBottom: '24px'
    },
    sizeLabel: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px'
    },
    sizeLabelText: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#3d3129'
    },
    sizeGuideLink: {
      fontSize: '13px',
      color: '#6b5d4d',
      textDecoration: 'underline',
      cursor: 'pointer'
    },
    sizes: {
      display: 'flex',
      gap: '8px'
    },
    sizeButton: (selected, available, recommended) => ({
      width: '48px',
      height: '48px',
      border: selected ? '2px solid #3d3129' : '1px solid #d9d5ce',
      background: selected ? '#3d3129' : available ? '#fff' : '#f5f5f5',
      color: selected ? '#fff' : available ? '#3d3129' : '#b0a090',
      fontSize: '14px',
      fontWeight: '600',
      cursor: available ? 'pointer' : 'not-allowed',
      position: 'relative'
    }),
    recommendedDot: {
      position: 'absolute',
      top: '-4px',
      right: '-4px',
      width: '12px',
      height: '12px',
      background: '#4a6b4a',
      borderRadius: '50%',
      border: '2px solid #fff'
    },
    tryOnButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      width: '100%',
      padding: '16px',
      background: '#f8f7f5',
      border: '1px solid #d9d5ce',
      color: '#3d3129',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      marginBottom: '12px'
    },
    addToCart: {
      width: '100%',
      padding: '18px',
      background: '#3d3129',
      border: 'none',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '600',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      cursor: 'pointer',
      marginBottom: '24px'
    },
    description: {
      fontSize: '14px',
      lineHeight: '1.8',
      color: '#3d3129',
      marginBottom: '24px'
    },
    details: {
      borderTop: '1px solid #e5e0d8',
      paddingTop: '20px'
    },
    detailItem: {
      fontSize: '13px',
      color: '#6b5d4d',
      marginBottom: '8px',
      paddingLeft: '16px',
      position: 'relative'
    },
    banner: {
      marginBottom: '16px',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, #3d3129 0%, #5a4a3a 100%)',
      color: '#fff',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    bannerIcon: {
      fontSize: '16px'
    }
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>CHARCOAL</div>
        <nav style={styles.nav}>
          <a style={styles.navLink} href="#">NEW</a>
          <a style={styles.navLink} href="#">CLOTHING</a>
          <a style={styles.navLink} href="#">SALE</a>
        </nav>
      </header>

      {/* Product */}
      <div style={styles.container}>
        <div style={styles.grid}>
          {/* Gallery */}
          <div style={styles.gallery}>
            <div style={styles.thumbs}>
              {DEMO_PRODUCT.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`View ${i + 1}`}
                  style={styles.thumb(i === selectedImage)}
                  onClick={() => setSelectedImage(i)}
                />
              ))}
            </div>
            <img
              src={DEMO_PRODUCT.images[selectedImage]}
              alt={DEMO_PRODUCT.title}
              style={styles.mainImage}
            />
          </div>

          {/* Info */}
          <div style={styles.productInfo}>
            <div style={styles.breadcrumb}>DRESSES / MIDI</div>
            <h1 style={styles.title}>{DEMO_PRODUCT.title}</h1>
            <div style={styles.subtitle}>{DEMO_PRODUCT.subtitle}</div>
            <div style={styles.price}>{DEMO_PRODUCT.price}</div>

            {/* Loocbooc banner */}
            {avatar && (
              <div style={styles.banner}>
                <span style={styles.bannerIcon}>✨</span>
                {recommendedSize 
                  ? `Your recommended size is ${recommendedSize}` 
                  : 'Finding your perfect size...'}
              </div>
            )}

            {/* Size selector */}
            <div style={styles.sizeSection}>
              <div style={styles.sizeLabel}>
                <span style={styles.sizeLabelText}>Size</span>
                <span 
                  style={styles.sizeGuideLink}
                  onClick={() => setShowSizeGuide(true)}
                >
                  Size Guide
                </span>
              </div>
              <div style={styles.sizes}>
                {DEMO_PRODUCT.variants.map(v => (
                  <button
                    key={v.id}
                    style={styles.sizeButton(
                      selectedSize === v.option1, 
                      v.available,
                      recommendedSize === v.option1
                    )}
                    onClick={() => v.available && setSelectedSize(v.option1)}
                    disabled={!v.available}
                  >
                    {v.option1}
                    {recommendedSize === v.option1 && (
                      <div style={styles.recommendedDot} title="Recommended for you" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Try-On button */}
            <button style={styles.tryOnButton} onClick={() => setShowTryOn(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {avatar ? 'See on Your Avatar' : 'Virtual Try-On'}
            </button>

            {/* Add to cart */}
            <button style={styles.addToCart}>
              Add to Cart
            </button>

            {/* Description */}
            <p style={styles.description}>{DEMO_PRODUCT.description}</p>

            {/* Details */}
            <div style={styles.details}>
              {DEMO_PRODUCT.details.map((detail, i) => (
                <div key={i} style={styles.detailItem}>• {detail}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Try-On Modal */}
      <TryOnModal
        isOpen={showTryOn}
        onClose={() => setShowTryOn(false)}
        product={DEMO_PRODUCT}
        avatar={avatar}
        onAvatarCreated={handleAvatarCreated}
        apiBaseUrl="http://localhost:3000/api"
      />

      {/* Size Guide Modal */}
      {showSizeGuide && avatar?.measurements && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowSizeGuide(false)}
        >
          <div 
            style={{ background: '#fff', maxWidth: '500px', width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e0d8', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '16px', fontWeight: '600' }}>Size Guide</span>
              <button onClick={() => setShowSizeGuide(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <SizeComparison
              customerMeasurements={avatar.measurements}
              sizeChart={DEMO_PRODUCT.sizeChart}
              recommendedSize={recommendedSize}
              onSizeSelect={(size) => {
                setSelectedSize(size);
                setShowSizeGuide(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default DemoPage;
