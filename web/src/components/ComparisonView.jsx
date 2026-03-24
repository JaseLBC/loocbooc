/**
 * ComparisonView - Side-by-side model vs avatar comparison
 */

import React, { useState } from 'react';
import { TryOnViewer } from './TryOnViewer';

export function ComparisonView({ 
  modelImages, 
  avatar, 
  garment, 
  selectedSize,
  selectedColor,
  fitAnalysis 
}) {
  const [activeModelImage, setActiveModelImage] = useState(0);
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'overlay' | 'model' | 'avatar'

  const styles = {
    container: {
      fontFamily: 'Inter, sans-serif',
    },
    controls: {
      display: 'flex',
      justifyContent: 'center',
      gap: '8px',
      marginBottom: '16px'
    },
    controlButton: (active) => ({
      padding: '8px 16px',
      border: '1px solid #d9d5ce',
      background: active ? '#3d3129' : 'transparent',
      color: active ? '#e5e0d8' : '#3d3129',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      cursor: 'pointer'
    }),
    splitView: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    },
    panel: {
      position: 'relative'
    },
    panelLabel: {
      position: 'absolute',
      top: '12px',
      left: '12px',
      background: 'rgba(61, 49, 41, 0.9)',
      color: '#e5e0d8',
      padding: '6px 12px',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      zIndex: 10
    },
    modelImage: {
      width: '100%',
      height: '500px',
      objectFit: 'cover',
      background: '#f5f5f5'
    },
    imageThumbs: {
      display: 'flex',
      gap: '8px',
      marginTop: '8px'
    },
    thumb: (active) => ({
      width: '60px',
      height: '80px',
      objectFit: 'cover',
      cursor: 'pointer',
      border: active ? '2px solid #3d3129' : '2px solid transparent',
      opacity: active ? 1 : 0.6
    }),
    fitCard: {
      marginTop: '24px',
      padding: '20px',
      background: '#f5f5f5'
    },
    fitTitle: {
      fontSize: '14px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: '16px',
      color: '#3d3129'
    },
    fitRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderTop: '1px solid #e5e0d8'
    },
    fitLabel: {
      fontSize: '13px',
      color: '#6b5d4d'
    },
    fitValue: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#3d3129'
    },
    fitScore: (score) => ({
      display: 'inline-block',
      width: '60px',
      height: '6px',
      background: '#e5e0d8',
      borderRadius: '3px',
      overflow: 'hidden',
      marginRight: '8px'
    }),
    fitScoreBar: (score) => ({
      height: '100%',
      width: `${score * 100}%`,
      background: score >= 0.8 ? '#4a6b4a' : score >= 0.6 ? '#8b7355' : '#8b4444',
      borderRadius: '3px'
    }),
    recommendation: {
      marginTop: '16px',
      padding: '12px',
      background: '#e5e0d8',
      fontSize: '14px',
      color: '#3d3129'
    },
    recommendationTitle: {
      fontWeight: '700',
      marginBottom: '4px'
    }
  };

  const renderModelPanel = () => (
    <div style={styles.panel}>
      <div style={styles.panelLabel}>Model</div>
      {modelImages && modelImages.length > 0 ? (
        <>
          <img 
            src={modelImages[activeModelImage]} 
            alt="Model" 
            style={styles.modelImage} 
          />
          {modelImages.length > 1 && (
            <div style={styles.imageThumbs}>
              {modelImages.slice(0, 4).map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`View ${idx + 1}`}
                  style={styles.thumb(idx === activeModelImage)}
                  onClick={() => setActiveModelImage(idx)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ ...styles.modelImage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          No model image
        </div>
      )}
    </div>
  );

  const renderAvatarPanel = () => (
    <div style={styles.panel}>
      <div style={styles.panelLabel}>You</div>
      <TryOnViewer
        avatar={avatar}
        garment={garment}
        size={selectedSize}
        color={selectedColor}
        style={{ height: '500px' }}
      />
    </div>
  );

  const renderFitAnalysis = () => {
    if (!fitAnalysis) return null;
    
    return (
      <div style={styles.fitCard}>
        <div style={styles.fitTitle}>Fit Analysis</div>
        
        {fitAnalysis.areas && Object.entries(fitAnalysis.areas).map(([area, data]) => (
          <div key={area} style={styles.fitRow}>
            <span style={styles.fitLabel}>{area.charAt(0).toUpperCase() + area.slice(1)}</span>
            <span style={styles.fitValue}>
              <span style={styles.fitScore(data.score)}>
                <span style={styles.fitScoreBar(data.score)} />
              </span>
              {data.description}
            </span>
          </div>
        ))}
        
        {fitAnalysis.recommendation && (
          <div style={styles.recommendation}>
            <div style={styles.recommendationTitle}>
              Recommended: {fitAnalysis.recommendation.size}
            </div>
            {fitAnalysis.recommendation.message}
          </div>
        )}
        
        {fitAnalysis.notes && fitAnalysis.notes.length > 0 && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b5d4d' }}>
            {fitAnalysis.notes.map((note, idx) => (
              <p key={idx} style={{ margin: '4px 0' }}>• {note}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* View mode controls */}
      <div style={styles.controls}>
        <button 
          style={styles.controlButton(viewMode === 'split')}
          onClick={() => setViewMode('split')}
        >
          Split View
        </button>
        <button 
          style={styles.controlButton(viewMode === 'model')}
          onClick={() => setViewMode('model')}
        >
          Model Only
        </button>
        <button 
          style={styles.controlButton(viewMode === 'avatar')}
          onClick={() => setViewMode('avatar')}
        >
          You Only
        </button>
      </div>
      
      {/* Main comparison view */}
      {viewMode === 'split' && (
        <div style={styles.splitView}>
          {renderModelPanel()}
          {renderAvatarPanel()}
        </div>
      )}
      
      {viewMode === 'model' && renderModelPanel()}
      {viewMode === 'avatar' && renderAvatarPanel()}
      
      {/* Fit analysis */}
      {renderFitAnalysis()}
    </div>
  );
}

export default ComparisonView;
