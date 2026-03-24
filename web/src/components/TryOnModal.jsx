/**
 * TryOnModal - Main modal for try-on experience on product page
 * This is what customers see when they click "Try On"
 */

import React, { useState, useEffect } from 'react';
import { TryOnViewer } from './TryOnViewer';
import { AvatarCreator } from './AvatarCreator';
import { ComparisonView } from './ComparisonView';

export function TryOnModal({ 
  isOpen, 
  onClose, 
  product, 
  user, 
  avatar: existingAvatar,
  onAvatarCreated,
  apiBaseUrl = '/api'
}) {
  const [step, setStep] = useState('loading'); // 'loading' | 'create-avatar' | 'tryon'
  const [avatar, setAvatar] = useState(existingAvatar);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [tryOnData, setTryOnData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Determine initial step
  useEffect(() => {
    if (existingAvatar) {
      setAvatar(existingAvatar);
      setStep('tryon');
    } else if (user) {
      // Check if user has avatar
      fetchUserAvatar();
    } else {
      setStep('create-avatar');
    }
  }, [existingAvatar, user]);

  // Set default size/color from product
  useEffect(() => {
    if (product?.variants?.length > 0) {
      const firstVariant = product.variants[0];
      if (!selectedSize && firstVariant.option1) {
        setSelectedSize(firstVariant.option1);
      }
      if (!selectedColor && firstVariant.option2) {
        setSelectedColor(firstVariant.option2);
      }
    }
  }, [product]);

  const fetchUserAvatar = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/avatar`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.avatar) {
        setAvatar(data.avatar);
        setStep('tryon');
      } else {
        setStep('create-avatar');
      }
    } catch (err) {
      setStep('create-avatar');
    }
  };

  const handleAvatarCreate = async (avatarData) => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = avatarData.source === 'photos' 
        ? `${apiBaseUrl}/avatar/photos`
        : `${apiBaseUrl}/avatar/measurements`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user ? `Bearer ${user.token}` : ''
        },
        body: JSON.stringify(avatarData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create avatar');
      }
      
      setAvatar(data.avatar);
      onAvatarCreated?.(data.avatar);
      setStep('tryon');
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateTryOn = async () => {
    if (!avatar || !product) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/tryon/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user ? `Bearer ${user.token}` : ''
        },
        body: JSON.stringify({
          avatarId: avatar.id,
          garmentId: product.loocboocGarmentId,
          size: selectedSize,
          color: selectedColor
        })
      });
      
      const data = await res.json();
      setTryOnData(data.render);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate try-on when size/color changes
  useEffect(() => {
    if (step === 'tryon' && avatar && product && selectedSize) {
      generateTryOn();
    }
  }, [step, avatar, product, selectedSize, selectedColor]);

  if (!isOpen) return null;

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    },
    modal: {
      background: '#fff',
      width: '100%',
      maxWidth: '1000px',
      maxHeight: '90vh',
      overflow: 'auto',
      position: 'relative',
      fontFamily: 'Inter, sans-serif'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 24px',
      borderBottom: '1px solid #e5e0d8'
    },
    title: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#3d3129'
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#6b5d4d',
      padding: '4px'
    },
    body: {
      padding: '24px'
    },
    productInfo: {
      display: 'flex',
      gap: '16px',
      marginBottom: '24px',
      paddingBottom: '24px',
      borderBottom: '1px solid #e5e0d8'
    },
    productImage: {
      width: '80px',
      height: '100px',
      objectFit: 'cover'
    },
    productDetails: {
      flex: 1
    },
    productTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#3d3129',
      marginBottom: '8px'
    },
    sizeSelector: {
      display: 'flex',
      gap: '8px',
      marginTop: '12px'
    },
    sizeButton: (active) => ({
      padding: '8px 16px',
      border: '1px solid #d9d5ce',
      background: active ? '#3d3129' : 'transparent',
      color: active ? '#e5e0d8' : '#3d3129',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer'
    }),
    loocboocBranding: {
      textAlign: 'center',
      padding: '16px',
      borderTop: '1px solid #e5e0d8',
      fontSize: '12px',
      color: '#8b7355'
    },
    error: {
      background: '#fee',
      color: '#c00',
      padding: '12px',
      marginBottom: '16px'
    }
  };

  const availableSizes = product?.variants
    ?.map(v => v.option1)
    .filter((v, i, a) => v && a.indexOf(v) === i) || [];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>
            {step === 'create-avatar' ? 'Create Your Avatar' : 'Virtual Try-On'}
          </span>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        {/* Body */}
        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}
          
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              Loading...
            </div>
          )}
          
          {step === 'create-avatar' && (
            <AvatarCreator 
              onSave={handleAvatarCreate}
              onCancel={onClose}
            />
          )}
          
          {step === 'tryon' && (
            <>
              {/* Product info & size selector */}
              <div style={styles.productInfo}>
                {product?.images?.[0] && (
                  <img 
                    src={product.images[0]} 
                    alt={product.title}
                    style={styles.productImage}
                  />
                )}
                <div style={styles.productDetails}>
                  <div style={styles.productTitle}>{product?.title}</div>
                  <div style={{ fontSize: '13px', color: '#6b5d4d' }}>
                    Select size:
                  </div>
                  <div style={styles.sizeSelector}>
                    {availableSizes.map(size => (
                      <button
                        key={size}
                        style={styles.sizeButton(size === selectedSize)}
                        onClick={() => setSelectedSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Comparison view */}
              <ComparisonView
                modelImages={product?.images}
                avatar={{
                  modelUrl: avatar?.model_url,
                  measurements: avatar?.measurements
                }}
                garment={tryOnData?.data?.garment}
                selectedSize={selectedSize}
                selectedColor={selectedColor}
                fitAnalysis={tryOnData?.fitAnalysis}
              />
            </>
          )}
        </div>
        
        {/* Footer branding */}
        <div style={styles.loocboocBranding}>
          Powered by <strong>Loocbooc</strong> — Your avatar works everywhere
        </div>
      </div>
    </div>
  );
}

export default TryOnModal;
