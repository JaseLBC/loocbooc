/**
 * SizeQuiz - Guided size finding experience
 * Helps customers who don't know their measurements
 */

import React, { useState } from 'react';

const QUESTIONS = [
  {
    id: 'height',
    question: 'How tall are you?',
    type: 'options',
    options: [
      { label: "Under 5'2\" (157cm)", value: 155 },
      { label: "5'2\" - 5'4\" (157-163cm)", value: 160 },
      { label: "5'5\" - 5'7\" (165-170cm)", value: 167 },
      { label: "5'8\" - 5'10\" (173-178cm)", value: 175 },
      { label: "Over 5'10\" (178cm+)", value: 180 }
    ]
  },
  {
    id: 'usual_size_au',
    question: 'What size do you usually wear?',
    subtitle: 'Australian sizing',
    type: 'options',
    options: [
      { label: '4-6 (XXS-XS)', value: 'XXS-XS' },
      { label: '8 (S)', value: 'S' },
      { label: '10 (M)', value: 'M' },
      { label: '12 (L)', value: 'L' },
      { label: '14-16 (XL)', value: 'XL' },
      { label: '18+ (2XL+)', value: '2XL' }
    ]
  },
  {
    id: 'body_shape',
    question: 'Which best describes your body shape?',
    type: 'options',
    options: [
      { label: '⏳ Hourglass - Bust and hips similar, defined waist', value: 'hourglass' },
      { label: '🍐 Pear - Hips wider than bust', value: 'pear' },
      { label: '🍎 Apple - Fuller middle', value: 'apple' },
      { label: '📏 Rectangle - Balanced, less defined waist', value: 'rectangle' },
      { label: '🔺 Inverted triangle - Broader shoulders', value: 'inverted-triangle' }
    ]
  },
  {
    id: 'bust_fit',
    question: 'How do tops usually fit your bust?',
    type: 'options',
    options: [
      { label: 'Usually loose/roomy', value: 'small' },
      { label: 'Usually fits well', value: 'average' },
      { label: 'Often tight/snug', value: 'large' }
    ]
  },
  {
    id: 'hip_fit',
    question: 'How do pants usually fit your hips?',
    type: 'options',
    options: [
      { label: 'Usually loose/roomy', value: 'small' },
      { label: 'Usually fits well', value: 'average' },
      { label: 'Often tight/snug', value: 'large' }
    ]
  }
];

// Estimate measurements from quiz answers
function estimateMeasurements(answers) {
  const height = answers.height || 165;
  
  // Base measurements from usual size
  const sizeBases = {
    'XXS-XS': { bust: 80, waist: 60, hips: 85 },
    'S': { bust: 85, waist: 65, hips: 90 },
    'M': { bust: 90, waist: 70, hips: 95 },
    'L': { bust: 95, waist: 75, hips: 100 },
    'XL': { bust: 100, waist: 80, hips: 105 },
    '2XL': { bust: 108, waist: 88, hips: 113 }
  };
  
  const base = sizeBases[answers.usual_size_au] || sizeBases['M'];
  
  // Adjust for body shape
  let { bust, waist, hips } = base;
  
  switch (answers.body_shape) {
    case 'hourglass':
      waist -= 3;
      break;
    case 'pear':
      hips += 3;
      bust -= 2;
      break;
    case 'apple':
      waist += 3;
      break;
    case 'rectangle':
      waist += 2;
      break;
    case 'inverted-triangle':
      bust += 3;
      hips -= 2;
      break;
  }
  
  // Adjust for fit preferences
  if (answers.bust_fit === 'large') bust += 3;
  if (answers.bust_fit === 'small') bust -= 3;
  if (answers.hip_fit === 'large') hips += 3;
  if (answers.hip_fit === 'small') hips -= 3;
  
  return {
    height,
    bust: Math.round(bust),
    waist: Math.round(waist),
    hips: Math.round(hips),
    bodyType: answers.body_shape,
    confidence: 0.7, // Lower confidence than manual input
    source: 'quiz'
  };
}

export function SizeQuiz({ onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [measurements, setMeasurements] = useState(null);

  const currentQuestion = QUESTIONS[currentStep];
  const progress = ((currentStep + 1) / QUESTIONS.length) * 100;

  const handleAnswer = (value) => {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);
    
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Calculate measurements
      const estimated = estimateMeasurements(newAnswers);
      setMeasurements(estimated);
      setShowResult(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirm = () => {
    onComplete(measurements);
  };

  const styles = {
    container: {
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '32px',
      maxWidth: '500px'
    },
    header: {
      marginBottom: '24px'
    },
    title: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#3d3129',
      marginBottom: '8px'
    },
    progress: {
      height: '4px',
      background: '#e5e0d8',
      borderRadius: '2px',
      overflow: 'hidden',
      marginBottom: '8px'
    },
    progressBar: {
      height: '100%',
      background: '#3d3129',
      width: `${progress}%`,
      transition: 'width 0.3s ease'
    },
    progressText: {
      fontSize: '12px',
      color: '#8b7355'
    },
    question: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#3d3129',
      marginBottom: '8px'
    },
    subtitle: {
      fontSize: '14px',
      color: '#6b5d4d',
      marginBottom: '24px'
    },
    options: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    option: {
      padding: '16px 20px',
      border: '1px solid #d9d5ce',
      background: '#fff',
      color: '#3d3129',
      fontSize: '15px',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    optionHover: {
      borderColor: '#3d3129',
      background: '#f8f7f5'
    },
    back: {
      marginTop: '24px',
      padding: '12px',
      background: 'none',
      border: 'none',
      color: '#6b5d4d',
      fontSize: '14px',
      cursor: 'pointer'
    },
    result: {
      background: '#f8f7f5',
      padding: '24px',
      marginBottom: '24px'
    },
    resultTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#3d3129',
      marginBottom: '16px'
    },
    measurement: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: '1px solid #e5e0d8'
    },
    measurementLabel: {
      color: '#6b5d4d'
    },
    measurementValue: {
      fontWeight: '600',
      color: '#3d3129'
    },
    note: {
      marginTop: '16px',
      padding: '12px',
      background: '#fff',
      fontSize: '13px',
      color: '#6b5d4d'
    },
    actions: {
      display: 'flex',
      gap: '12px'
    },
    button: (primary) => ({
      flex: 1,
      padding: '14px 24px',
      border: primary ? 'none' : '1px solid #d9d5ce',
      background: primary ? '#3d3129' : '#fff',
      color: primary ? '#fff' : '#3d3129',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer'
    })
  };

  if (showResult) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Your Estimated Measurements</h2>
        </div>
        
        <div style={styles.result}>
          <div style={styles.resultTitle}>Based on your answers</div>
          <div style={styles.measurement}>
            <span style={styles.measurementLabel}>Height</span>
            <span style={styles.measurementValue}>{measurements.height} cm</span>
          </div>
          <div style={styles.measurement}>
            <span style={styles.measurementLabel}>Bust</span>
            <span style={styles.measurementValue}>{measurements.bust} cm</span>
          </div>
          <div style={styles.measurement}>
            <span style={styles.measurementLabel}>Waist</span>
            <span style={styles.measurementValue}>{measurements.waist} cm</span>
          </div>
          <div style={styles.measurement}>
            <span style={styles.measurementLabel}>Hips</span>
            <span style={styles.measurementValue}>{measurements.hips} cm</span>
          </div>
          
          <div style={styles.note}>
            💡 These are estimates. For more accurate sizing, you can edit these measurements or take photos.
          </div>
        </div>
        
        <div style={styles.actions}>
          <button 
            style={styles.button(false)} 
            onClick={() => { setShowResult(false); setCurrentStep(0); }}
          >
            Retake Quiz
          </button>
          <button style={styles.button(true)} onClick={handleConfirm}>
            Use These
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Find Your Size</h2>
        <div style={styles.progress}>
          <div style={styles.progressBar} />
        </div>
        <div style={styles.progressText}>
          Question {currentStep + 1} of {QUESTIONS.length}
        </div>
      </div>
      
      <div style={styles.question}>{currentQuestion.question}</div>
      {currentQuestion.subtitle && (
        <div style={styles.subtitle}>{currentQuestion.subtitle}</div>
      )}
      
      <div style={styles.options}>
        {currentQuestion.options.map((option) => (
          <button
            key={option.value}
            style={styles.option}
            onClick={() => handleAnswer(option.value)}
            onMouseEnter={(e) => Object.assign(e.target.style, styles.optionHover)}
            onMouseLeave={(e) => Object.assign(e.target.style, { borderColor: '#d9d5ce', background: '#fff' })}
          >
            {option.label}
          </button>
        ))}
      </div>
      
      {currentStep > 0 && (
        <button style={styles.back} onClick={handleBack}>
          ← Back
        </button>
      )}
      
      {onCancel && (
        <button 
          style={{ ...styles.back, marginLeft: '16px' }} 
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

export default SizeQuiz;
