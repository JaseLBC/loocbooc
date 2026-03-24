/**
 * Size Recommendation Engine
 * Matches customer measurements to garment size charts
 */

// Standard size chart (Charcoal default)
const STANDARD_SIZE_CHART = {
  AU: {
    '4': { bust: [76, 80], waist: [58, 62], hips: [82, 86] },
    '6': { bust: [80, 84], waist: [62, 66], hips: [86, 90] },
    '8': { bust: [84, 88], waist: [66, 70], hips: [90, 94] },
    '10': { bust: [88, 92], waist: [70, 74], hips: [94, 98] },
    '12': { bust: [92, 96], waist: [74, 78], hips: [98, 102] },
    '14': { bust: [96, 100], waist: [78, 82], hips: [102, 106] },
    '16': { bust: [100, 105], waist: [82, 87], hips: [106, 111] },
    '18': { bust: [105, 110], waist: [87, 92], hips: [111, 116] },
  },
  US: {
    '0': { bust: [76, 80], waist: [58, 62], hips: [82, 86] },
    '2': { bust: [80, 84], waist: [62, 66], hips: [86, 90] },
    '4': { bust: [84, 88], waist: [66, 70], hips: [90, 94] },
    '6': { bust: [88, 92], waist: [70, 74], hips: [94, 98] },
    '8': { bust: [92, 96], waist: [74, 78], hips: [98, 102] },
    '10': { bust: [96, 100], waist: [78, 82], hips: [102, 106] },
    '12': { bust: [100, 105], waist: [82, 87], hips: [106, 111] },
    '14': { bust: [105, 110], waist: [87, 92], hips: [111, 116] },
  },
  XS_XL: {
    'XXS': { bust: [76, 80], waist: [58, 62], hips: [82, 86] },
    'XS': { bust: [80, 84], waist: [62, 66], hips: [86, 90] },
    'S': { bust: [84, 88], waist: [66, 70], hips: [90, 94] },
    'M': { bust: [88, 92], waist: [70, 74], hips: [94, 98] },
    'L': { bust: [92, 98], waist: [74, 80], hips: [98, 104] },
    'XL': { bust: [98, 104], waist: [80, 86], hips: [104, 110] },
    '2XL': { bust: [104, 110], waist: [86, 92], hips: [110, 116] },
  }
};

/**
 * Calculate how well a measurement fits a size range
 * Returns a score from 0-100
 */
function calculateFitScore(measurement, [min, max]) {
  if (!measurement) return 50; // Neutral if no measurement
  
  const mid = (min + max) / 2;
  const range = max - min;
  
  if (measurement >= min && measurement <= max) {
    // Within range - score based on how centered
    const distFromMid = Math.abs(measurement - mid);
    const maxDist = range / 2;
    return 100 - (distFromMid / maxDist) * 20; // 80-100 score
  } else if (measurement < min) {
    // Too small for this size
    const underBy = min - measurement;
    return Math.max(0, 70 - underBy * 5);
  } else {
    // Too large for this size
    const overBy = measurement - max;
    return Math.max(0, 70 - overBy * 5);
  }
}

/**
 * Get fit description based on score
 */
function getFitDescription(score) {
  if (score >= 90) return { label: 'Perfect fit', emoji: '✨' };
  if (score >= 80) return { label: 'Great fit', emoji: '👍' };
  if (score >= 70) return { label: 'Good fit', emoji: '👌' };
  if (score >= 60) return { label: 'Acceptable', emoji: '➖' };
  if (score >= 50) return { label: 'May be snug', emoji: '⚠️' };
  return { label: 'Not recommended', emoji: '❌' };
}

/**
 * Recommend sizes for customer measurements
 */
export function recommendSizes(customerMeasurements, garmentSizeChart = null, region = 'AU') {
  const { bust, waist, hips } = customerMeasurements;
  
  // Use garment-specific size chart if provided, otherwise use standard
  const sizeChart = garmentSizeChart || STANDARD_SIZE_CHART[region] || STANDARD_SIZE_CHART.XS_XL;
  
  const recommendations = [];
  
  for (const [size, ranges] of Object.entries(sizeChart)) {
    const bustScore = ranges.bust ? calculateFitScore(bust, ranges.bust) : 75;
    const waistScore = ranges.waist ? calculateFitScore(waist, ranges.waist) : 75;
    const hipsScore = ranges.hips ? calculateFitScore(hips, ranges.hips) : 75;
    
    // Weight: hips most important for bottoms, bust for tops
    // For dresses, all three matter
    const overallScore = (bustScore * 0.35 + waistScore * 0.3 + hipsScore * 0.35);
    
    const fit = getFitDescription(overallScore);
    
    recommendations.push({
      size,
      score: Math.round(overallScore),
      fit,
      details: {
        bust: { score: Math.round(bustScore), ...getFitDescription(bustScore) },
        waist: { score: Math.round(waistScore), ...getFitDescription(waistScore) },
        hips: { score: Math.round(hipsScore), ...getFitDescription(hipsScore) }
      },
      sizeRanges: ranges
    });
  }
  
  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);
  
  // Mark the best recommendation
  if (recommendations.length > 0) {
    recommendations[0].recommended = true;
  }
  
  return recommendations;
}

/**
 * Get single best size recommendation
 */
export function getBestSize(customerMeasurements, garmentSizeChart = null, region = 'AU') {
  const recommendations = recommendSizes(customerMeasurements, garmentSizeChart, region);
  
  if (recommendations.length === 0) {
    return null;
  }
  
  const best = recommendations[0];
  const secondBest = recommendations[1];
  
  return {
    size: best.size,
    confidence: best.score,
    fit: best.fit,
    details: best.details,
    alternative: secondBest ? {
      size: secondBest.size,
      reason: best.score - secondBest.score < 5 
        ? 'Very close fit - try both' 
        : 'If you prefer more room'
    } : null,
    notes: generateFitNotes(customerMeasurements, best)
  };
}

/**
 * Generate personalized fit notes
 */
function generateFitNotes(measurements, bestFit) {
  const notes = [];
  
  const { bust, waist, hips } = measurements;
  const ranges = bestFit.sizeRanges;
  
  // Bust notes
  if (ranges.bust) {
    const [bustMin, bustMax] = ranges.bust;
    if (bust > bustMax + 2) {
      notes.push('May be snug around the bust - consider sizing up for comfort');
    } else if (bust < bustMin - 2) {
      notes.push('Relaxed fit around the bust');
    }
  }
  
  // Waist notes
  if (ranges.waist) {
    const [waistMin, waistMax] = ranges.waist;
    if (waist > waistMax + 2) {
      notes.push('May be fitted at the waist');
    } else if (waist < waistMin - 2) {
      notes.push('Loose fit at the waist - could belt for more definition');
    }
  }
  
  // Hip notes
  if (ranges.hips) {
    const [hipsMin, hipsMax] = ranges.hips;
    if (hips > hipsMax + 2) {
      notes.push('Hips may be snug - check hip measurement in size guide');
    }
  }
  
  // Body type notes
  const bustWaistDiff = bust - waist;
  const hipsWaistDiff = hips - waist;
  
  if (bustWaistDiff > 25 && hipsWaistDiff > 25) {
    notes.push('Your hourglass figure will look great in this!');
  } else if (hipsWaistDiff > 30) {
    notes.push('Great for your pear shape - hips will be beautifully accentuated');
  }
  
  return notes;
}

/**
 * Convert between size systems
 */
export function convertSize(size, fromSystem, toSystem) {
  const conversions = {
    'AU_to_US': { '4': '0', '6': '2', '8': '4', '10': '6', '12': '8', '14': '10', '16': '12', '18': '14' },
    'US_to_AU': { '0': '4', '2': '6', '4': '8', '6': '10', '8': '12', '10': '14', '12': '16', '14': '18' },
    'AU_to_XS': { '4': 'XXS', '6': 'XS', '8': 'S', '10': 'M', '12': 'L', '14': 'XL', '16': '2XL' },
    'XS_to_AU': { 'XXS': '4', 'XS': '6', 'S': '8', 'M': '10', 'L': '12', 'XL': '14', '2XL': '16' }
  };
  
  const key = `${fromSystem}_to_${toSystem}`;
  return conversions[key]?.[size] || size;
}

export default { recommendSizes, getBestSize, convertSize };
