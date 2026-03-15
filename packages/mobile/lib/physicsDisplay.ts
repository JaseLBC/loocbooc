/**
 * Convert raw physics parameters (0-1 floats) to human-readable display values
 */

export interface PhysicsDisplayItem {
  label: string;
  value: number;    // 0-1
  level: 'Low' | 'Medium' | 'High';
  description: string;
  icon: string;
}

export function physicsToDisplay(physics: {
  drape: number;
  stretch: number;
  weight: number;
  stiffness: number;
  recovery: number;
}): PhysicsDisplayItem[] {
  return [
    {
      label: 'Drape',
      value: physics.drape,
      level: getLevel(physics.drape),
      description: getDrapeDescription(physics.drape),
      icon: '🌊',
    },
    {
      label: 'Stretch',
      value: physics.stretch,
      level: getLevel(physics.stretch),
      description: getStretchDescription(physics.stretch),
      icon: '↔️',
    },
    {
      label: 'Weight',
      value: physics.weight,
      level: getLevel(physics.weight),
      description: getWeightDescription(physics.weight),
      icon: '⚖️',
    },
    {
      label: 'Stiffness',
      value: physics.stiffness,
      level: getLevel(physics.stiffness),
      description: getStiffnessDescription(physics.stiffness),
      icon: '📐',
    },
    {
      label: 'Recovery',
      value: physics.recovery,
      level: getLevel(physics.recovery),
      description: getRecoveryDescription(physics.recovery),
      icon: '🔄',
    },
  ];
}

function getLevel(value: number): 'Low' | 'Medium' | 'High' {
  if (value < 0.35) return 'Low';
  if (value < 0.65) return 'Medium';
  return 'High';
}

function getDrapeDescription(v: number): string {
  if (v < 0.35) return 'Holds its shape. Structured silhouette.';
  if (v < 0.65) return 'Moderate flow. Balanced structure.';
  return 'Fluid and flowing. Follows the body.';
}

function getStretchDescription(v: number): string {
  if (v < 0.35) return 'Minimal stretch. Woven construction.';
  if (v < 0.65) return 'Moderate stretch. Comfortable fit.';
  return 'High stretch. Moves with the body.';
}

function getWeightDescription(v: number): string {
  if (v < 0.35) return 'Lightweight. Airy and breathable.';
  if (v < 0.65) return 'Mid-weight. Versatile all-season.';
  return 'Heavyweight. Substantial hand feel.';
}

function getStiffnessDescription(v: number): string {
  if (v < 0.35) return 'Very soft. Minimal structure.';
  if (v < 0.65) return 'Medium body. Holds light structure.';
  return 'Crisp and structured. Holds shape well.';
}

function getRecoveryDescription(v: number): string {
  if (v < 0.35) return 'Prone to creasing. Iron after wear.';
  if (v < 0.65) return 'Moderate recovery. Some wrinkling.';
  return 'Excellent recovery. Resists creasing.';
}
