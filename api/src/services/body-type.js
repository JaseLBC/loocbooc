/**
 * Body Type Detection
 * Determines body shape from measurements
 */

/**
 * Detect body type from measurements
 * Returns one of: hourglass, pear, apple, rectangle, inverted-triangle
 */
export function detectBodyType({ bust, waist, hips }) {
  if (!bust || !waist || !hips) {
    return { type: 'unknown', confidence: 0 };
  }
  
  // Calculate ratios
  const bustHipRatio = bust / hips;
  const waistHipRatio = waist / hips;
  const waistBustRatio = waist / bust;
  const hipBustDiff = hips - bust;
  const bustWaistDiff = bust - waist;
  const hipWaistDiff = hips - waist;
  
  // Scoring for each body type
  const scores = {
    hourglass: 0,
    pear: 0,
    apple: 0,
    rectangle: 0,
    'inverted-triangle': 0
  };
  
  // Hourglass: Bust and hips similar (within 5%), waist significantly smaller
  if (Math.abs(bustHipRatio - 1) < 0.05 && waistHipRatio < 0.75) {
    scores.hourglass += 50;
  }
  if (bustWaistDiff > 20 && hipWaistDiff > 20) {
    scores.hourglass += 30;
  }
  if (waistBustRatio < 0.8) {
    scores.hourglass += 20;
  }
  
  // Pear: Hips significantly larger than bust
  if (hipBustDiff > 5) {
    scores.pear += 40;
  }
  if (hips > bust * 1.05) {
    scores.pear += 30;
  }
  if (waistHipRatio < 0.8) {
    scores.pear += 20;
  }
  
  // Apple: Bust larger than hips, or waist close to hips
  if (bust > hips) {
    scores.apple += 30;
  }
  if (waistHipRatio > 0.85) {
    scores.apple += 40;
  }
  if (waist > hips * 0.9) {
    scores.apple += 20;
  }
  
  // Rectangle: All measurements relatively similar
  if (Math.abs(bustHipRatio - 1) < 0.1 && waistHipRatio > 0.8) {
    scores.rectangle += 50;
  }
  if (bustWaistDiff < 20 && hipWaistDiff < 20) {
    scores.rectangle += 30;
  }
  
  // Inverted Triangle: Bust/shoulders significantly larger than hips
  if (bust > hips * 1.05) {
    scores['inverted-triangle'] += 40;
  }
  if (bustHipRatio > 1.1) {
    scores['inverted-triangle'] += 40;
  }
  
  // Find highest scoring body type
  const maxScore = Math.max(...Object.values(scores));
  const type = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'rectangle';
  
  // Normalize confidence (0-1)
  const confidence = Math.min(maxScore / 100, 1);
  
  return {
    type,
    confidence,
    scores,
    ratios: {
      bustHipRatio: Math.round(bustHipRatio * 100) / 100,
      waistHipRatio: Math.round(waistHipRatio * 100) / 100,
      waistBustRatio: Math.round(waistBustRatio * 100) / 100
    }
  };
}

/**
 * Get styling tips for body type
 */
export function getStylingTips(bodyType) {
  const tips = {
    hourglass: {
      description: 'Balanced bust and hips with a defined waist',
      flattering: [
        'Fitted dresses that follow your curves',
        'Wrap dresses and tops',
        'High-waisted bottoms',
        'Belted styles that emphasize your waist'
      ],
      avoid: [
        'Boxy or shapeless silhouettes',
        'Very loose or oversized styles'
      ]
    },
    pear: {
      description: 'Hips wider than bust with a defined waist',
      flattering: [
        'A-line skirts and dresses',
        'Wide-leg pants that balance proportions',
        'Structured tops that add volume to shoulders',
        'Darker colors on bottom, lighter on top'
      ],
      avoid: [
        'Skinny jeans without a longer top',
        'Horizontal stripes on lower half'
      ]
    },
    apple: {
      description: 'Fuller midsection with slimmer legs',
      flattering: [
        'Empire waist dresses',
        'V-necklines that elongate',
        'Structured jackets that define shape',
        'Straight or bootcut pants'
      ],
      avoid: [
        'Tight waistbands',
        'Clingy fabrics around the middle'
      ]
    },
    rectangle: {
      description: 'Balanced proportions with less waist definition',
      flattering: [
        'Belted styles to create waist definition',
        'Peplum tops and dresses',
        'Layered looks that add dimension',
        'Ruched or gathered details at the waist'
      ],
      avoid: [
        'Very boxy styles that hide your shape'
      ]
    },
    'inverted-triangle': {
      description: 'Broader shoulders with narrower hips',
      flattering: [
        'V-necklines that soften shoulders',
        'Wide-leg pants that balance proportions',
        'Full skirts that add volume to hips',
        'Details and color on lower half'
      ],
      avoid: [
        'Shoulder pads or puffed sleeves',
        'Horizontal stripes on top'
      ]
    }
  };
  
  return tips[bodyType] || tips.rectangle;
}

/**
 * Get body type with description
 */
export function analyzeBodyType(measurements) {
  const detection = detectBodyType(measurements);
  const tips = getStylingTips(detection.type);
  
  return {
    ...detection,
    ...tips
  };
}

export default { detectBodyType, getStylingTips, analyzeBodyType };
