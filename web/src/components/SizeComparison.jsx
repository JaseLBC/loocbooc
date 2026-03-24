/**
 * SizeComparison - Visual comparison of customer vs garment sizes
 * Shows where the customer sits within each size's range
 */

import React from 'react';

export function SizeComparison({ 
  customerMeasurements, 
  sizeChart,
  recommendedSize,
  onSizeSelect 
}) {
  const { bust, waist, hips } = customerMeasurements || {};
  
  // Default size chart if none provided
  const sizes = sizeChart || {
    'XS': { bust: [80, 84], waist: [60, 64], hips: [86, 90] },
    'S': { bust: [84, 88], waist: [64, 68], hips: [90, 94] },
    'M': { bust: [88, 92], waist: [68, 72], hips: [94, 98] },
    'L': { bust: [92, 96], waist: [72, 76], hips: [98, 102] },
    'XL': { bust: [96, 100], waist: [76, 80], hips: [102, 106] }
  };
  
  const sizeOrder = Object.keys(sizes);
  
  // Calculate position within range (0-100%)
  const getPosition = (value, ranges) => {
    if (!value || !ranges) return null;
    
    const allMin = Math.min(...Object.values(ranges).map(r => r[0]));
    const allMax = Math.max(...Object.values(ranges).map(r => r[1]));
    const range = allMax - allMin;
    
    return ((value - allMin) / range) * 100;
  };
  
  // Get fit status for a measurement
  const getFitStatus = (value, [min, max]) => {
    if (!value) return 'unknown';
    if (value < min - 2) return 'too-small';
    if (value < min) return 'snug';
    if (value <= max) return 'good';
    if (value <= max + 2) return 'snug';
    return 'too-large';
  };

  const styles = {
    container: {
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '20px'
    },
    title: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#3d3129',
      marginBottom: '20px'
    },
    measurementRow: {
      marginBottom: '24px'
    },
    measurementLabel: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px'
    },
    measurementName: {
      fontSize: '13px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      color: '#6b5d4d'
    },
    measurementValue: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#3d3129'
    },
    chart: {
      position: 'relative',
      height: '40px',
      background: '#f5f5f5',
      borderRadius: '4px',
      overflow: 'hidden'
    },
    sizeRange: (index, total, isRecommended) => ({
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: `${(index / total) * 100}%`,
      width: `${100 / total}%`,
      background: isRecommended ? 'rgba(61, 49, 41, 0.15)' : 'transparent',
      borderRight: index < total - 1 ? '1px solid #e5e0d8' : 'none',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingBottom: '4px'
    }),
    sizeLabel: (isRecommended) => ({
      fontSize: '11px',
      fontWeight: isRecommended ? '700' : '500',
      color: isRecommended ? '#3d3129' : '#8b7355'
    }),
    marker: {
      position: 'absolute',
      top: '4px',
      transform: 'translateX(-50%)',
      width: '12px',
      height: '24px',
      background: '#3d3129',
      borderRadius: '6px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    },
    legend: {
      display: 'flex',
      gap: '16px',
      marginTop: '16px',
      flexWrap: 'wrap'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: '#6b5d4d'
    },
    legendDot: (color) => ({
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: color
    }),
    sizeCards: {
      display: 'flex',
      gap: '8px',
      marginTop: '24px',
      overflowX: 'auto',
      paddingBottom: '8px'
    },
    sizeCard: (isRecommended, isSelected) => ({
      flex: '0 0 auto',
      padding: '16px 20px',
      border: isSelected 
        ? '2px solid #3d3129' 
        : isRecommended 
          ? '2px solid #3d3129' 
          : '1px solid #d9d5ce',
      background: isRecommended ? '#f8f7f5' : '#fff',
      cursor: 'pointer',
      textAlign: 'center',
      minWidth: '80px'
    }),
    sizeCardSize: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#3d3129',
      marginBottom: '4px'
    },
    sizeCardFit: (status) => ({
      fontSize: '11px',
      fontWeight: '600',
      color: status === 'good' ? '#4a6b4a' : status === 'snug' ? '#8b7355' : '#8b4444'
    }),
    recommendedBadge: {
      display: 'inline-block',
      padding: '2px 6px',
      background: '#3d3129',
      color: '#fff',
      fontSize: '9px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginTop: '4px'
    }
  };

  const measurements = [
    { key: 'bust', label: 'Bust', value: bust },
    { key: 'waist', label: 'Waist', value: waist },
    { key: 'hips', label: 'Hips', value: hips }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.title}>Size Comparison</div>
      
      {measurements.map(({ key, label, value }) => {
        const ranges = {};
        sizeOrder.forEach(size => {
          if (sizes[size]?.[key]) {
            ranges[size] = sizes[size][key];
          }
        });
        
        const position = getPosition(value, ranges);
        
        return (
          <div key={key} style={styles.measurementRow}>
            <div style={styles.measurementLabel}>
              <span style={styles.measurementName}>{label}</span>
              <span style={styles.measurementValue}>
                {value ? `${value} cm` : '—'}
              </span>
            </div>
            
            <div style={styles.chart}>
              {sizeOrder.map((size, index) => (
                <div 
                  key={size}
                  style={styles.sizeRange(index, sizeOrder.length, size === recommendedSize)}
                >
                  <span style={styles.sizeLabel(size === recommendedSize)}>{size}</span>
                </div>
              ))}
              
              {position !== null && (
                <div style={{ ...styles.marker, left: `${position}%` }} />
              )}
            </div>
          </div>
        );
      })}
      
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={styles.legendDot('#3d3129')} />
          <span>Your measurement</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot('rgba(61, 49, 41, 0.15)'), border: '1px solid #3d3129' }} />
          <span>Recommended size</span>
        </div>
      </div>
      
      {/* Size cards for quick selection */}
      <div style={styles.sizeCards}>
        {sizeOrder.map(size => {
          const bustFit = bust ? getFitStatus(bust, sizes[size]?.bust || [0, 999]) : 'unknown';
          const waistFit = waist ? getFitStatus(waist, sizes[size]?.waist || [0, 999]) : 'unknown';
          const hipsFit = hips ? getFitStatus(hips, sizes[size]?.hips || [0, 999]) : 'unknown';
          
          const overallFit = [bustFit, waistFit, hipsFit].every(f => f === 'good') 
            ? 'Perfect fit'
            : [bustFit, waistFit, hipsFit].some(f => f === 'too-small' || f === 'too-large')
              ? 'May not fit'
              : 'Good fit';
          
          const fitStatus = overallFit.includes('Perfect') ? 'good' 
            : overallFit.includes('Good') ? 'snug' 
            : 'bad';
          
          return (
            <div 
              key={size}
              style={styles.sizeCard(size === recommendedSize, false)}
              onClick={() => onSizeSelect?.(size)}
            >
              <div style={styles.sizeCardSize}>{size}</div>
              <div style={styles.sizeCardFit(fitStatus)}>{overallFit}</div>
              {size === recommendedSize && (
                <div style={styles.recommendedBadge}>Best Fit</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SizeComparison;
