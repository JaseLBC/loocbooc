/**
 * Returns Predictor
 * Estimates return risk based on sizing decisions
 * Key metric for proving Loocbooc ROI to merchants
 */

// Industry average return rates by reason
const BASELINE_RETURN_RATES = {
  size_too_small: 0.12,    // 12% of orders
  size_too_large: 0.08,    // 8% of orders
  fit_not_as_expected: 0.10, // 10% of orders
  other: 0.05              // 5% of orders
};

// Total baseline return rate: ~35% for fashion (industry average)
const TOTAL_BASELINE_RETURN_RATE = 0.35;

// Loocbooc expected reduction in size-related returns
const LOOCBOOC_SIZE_RETURN_REDUCTION = 0.60; // 60% reduction
const LOOCBOOC_FIT_RETURN_REDUCTION = 0.40; // 40% reduction

/**
 * Calculate return risk for a specific size selection
 */
export function calculateReturnRisk({ customerMeasurements, selectedSize, sizeChart, garmentType }) {
  const { bust, waist, hips } = customerMeasurements;
  
  // Get size ranges
  const sizeRanges = sizeChart?.[selectedSize] || {
    bust: [88, 92],
    waist: [68, 72],
    hips: [94, 98]
  };
  
  // Calculate how well customer fits in selected size
  const bustFit = calculateFitScore(bust, sizeRanges.bust);
  const waistFit = calculateFitScore(waist, sizeRanges.waist);
  const hipsFit = calculateFitScore(hips, sizeRanges.hips);
  
  // Weight based on garment type
  const weights = getGarmentWeights(garmentType);
  const overallFit = (
    bustFit * weights.bust +
    waistFit * weights.waist +
    hipsFit * weights.hips
  );
  
  // Convert fit score to return probability
  // Perfect fit (1.0) = low return risk (~5%)
  // Poor fit (0.0) = high return risk (~50%)
  const baseReturnRisk = 0.05 + (1 - overallFit) * 0.45;
  
  // Determine likely return reason
  let returnReason = 'unlikely';
  let returnRiskBreakdown = {};
  
  if (overallFit < 0.6) {
    const avgMeasurement = (bust + hips) / 2;
    const avgRange = ((sizeRanges.bust?.[0] || 0) + (sizeRanges.hips?.[0] || 0)) / 2;
    
    if (avgMeasurement > avgRange) {
      returnReason = 'size_too_small';
      returnRiskBreakdown = {
        size_too_small: baseReturnRisk * 0.7,
        fit_not_as_expected: baseReturnRisk * 0.3
      };
    } else {
      returnReason = 'size_too_large';
      returnRiskBreakdown = {
        size_too_large: baseReturnRisk * 0.7,
        fit_not_as_expected: baseReturnRisk * 0.3
      };
    }
  }
  
  return {
    returnRisk: Math.round(baseReturnRisk * 100) / 100,
    returnRiskPercent: `${Math.round(baseReturnRisk * 100)}%`,
    likelyReason: returnReason,
    breakdown: returnRiskBreakdown,
    fitScore: Math.round(overallFit * 100) / 100,
    recommendation: getReturnRiskRecommendation(baseReturnRisk, overallFit)
  };
}

/**
 * Calculate fit score (0-1)
 */
function calculateFitScore(measurement, [min, max]) {
  if (!measurement || !min || !max) return 0.75;
  
  const mid = (min + max) / 2;
  const range = max - min;
  
  if (measurement >= min && measurement <= max) {
    const distFromMid = Math.abs(measurement - mid);
    return 1 - (distFromMid / (range * 1.5));
  } else if (measurement < min) {
    const underBy = min - measurement;
    return Math.max(0, 1 - underBy / 10);
  } else {
    const overBy = measurement - max;
    return Math.max(0, 1 - overBy / 10);
  }
}

/**
 * Get measurement weights by garment type
 */
function getGarmentWeights(garmentType) {
  const type = garmentType?.toLowerCase() || '';
  
  if (type.includes('dress')) {
    return { bust: 0.35, waist: 0.30, hips: 0.35 };
  }
  if (type.includes('top') || type.includes('blouse') || type.includes('shirt')) {
    return { bust: 0.50, waist: 0.30, hips: 0.20 };
  }
  if (type.includes('pant') || type.includes('jean') || type.includes('trouser')) {
    return { bust: 0.10, waist: 0.40, hips: 0.50 };
  }
  if (type.includes('skirt')) {
    return { bust: 0.10, waist: 0.45, hips: 0.45 };
  }
  
  return { bust: 0.33, waist: 0.34, hips: 0.33 };
}

/**
 * Get recommendation based on return risk
 */
function getReturnRiskRecommendation(risk, fitScore) {
  if (risk < 0.10) {
    return {
      level: 'low',
      message: 'Excellent fit predicted. Low return risk.',
      action: null
    };
  }
  if (risk < 0.20) {
    return {
      level: 'medium',
      message: 'Good fit predicted. Consider checking size guide.',
      action: 'review_size_guide'
    };
  }
  if (risk < 0.35) {
    return {
      level: 'high',
      message: 'This size may not fit well. Consider alternative size.',
      action: 'suggest_alternative'
    };
  }
  return {
    level: 'very_high',
    message: 'High return risk. Strongly recommend different size.',
    action: 'warn_user'
  };
}

/**
 * Calculate expected ROI for merchant from Loocbooc
 */
export function calculateMerchantROI({ 
  monthlyOrders, 
  averageOrderValue, 
  currentReturnRate = TOTAL_BASELINE_RETURN_RATE,
  returnProcessingCost = 15 // AUD per return
}) {
  // Current returns
  const currentMonthlyReturns = monthlyOrders * currentReturnRate;
  const currentReturnCosts = currentMonthlyReturns * (returnProcessingCost + averageOrderValue * 0.1); // processing + restocking
  
  // Size-related returns (what Loocbooc addresses)
  const sizeRelatedReturnRate = BASELINE_RETURN_RATES.size_too_small + 
                                BASELINE_RETURN_RATES.size_too_large + 
                                BASELINE_RETURN_RATES.fit_not_as_expected;
  const sizeRelatedReturns = monthlyOrders * sizeRelatedReturnRate;
  
  // Expected reduction with Loocbooc
  const expectedReturnReduction = sizeRelatedReturns * LOOCBOOC_SIZE_RETURN_REDUCTION;
  const newReturnRate = currentReturnRate - (sizeRelatedReturnRate * LOOCBOOC_SIZE_RETURN_REDUCTION);
  const newMonthlyReturns = monthlyOrders * newReturnRate;
  
  // Cost savings
  const monthlySavings = (currentMonthlyReturns - newMonthlyReturns) * (returnProcessingCost + averageOrderValue * 0.1);
  const annualSavings = monthlySavings * 12;
  
  // Additional revenue from conversion lift (try-on users convert 2-3x better)
  const tryOnAdoptionRate = 0.15; // 15% of visitors use try-on
  const conversionLift = 0.25; // 25% higher conversion for try-on users
  const additionalConversions = monthlyOrders * tryOnAdoptionRate * conversionLift;
  const additionalRevenue = additionalConversions * averageOrderValue;
  
  return {
    current: {
      monthlyReturns: Math.round(currentMonthlyReturns),
      returnRate: `${Math.round(currentReturnRate * 100)}%`,
      monthlyReturnCosts: Math.round(currentReturnCosts)
    },
    withLoocbooc: {
      monthlyReturns: Math.round(newMonthlyReturns),
      returnRate: `${Math.round(newReturnRate * 100)}%`,
      returnsReduced: Math.round(expectedReturnReduction)
    },
    savings: {
      monthlySavings: Math.round(monthlySavings),
      annualSavings: Math.round(annualSavings),
      additionalMonthlyRevenue: Math.round(additionalRevenue),
      totalAnnualBenefit: Math.round(annualSavings + additionalRevenue * 12)
    },
    roi: {
      // Assuming $500/month Loocbooc fee
      monthlyFee: 500,
      monthlyROI: `${Math.round((monthlySavings + additionalRevenue) / 500 * 100)}%`,
      paybackMonths: monthlySavings + additionalRevenue > 500 
        ? 'Immediate' 
        : `${Math.round(500 / (monthlySavings + additionalRevenue))} months`
    }
  };
}

export default { calculateReturnRisk, calculateMerchantROI };
