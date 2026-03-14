// ─── Questionnaire Type System ───────────────────────────────────────────────
// Strict TypeScript types matching loocbooc-stakeholder-questionnaires.json

export type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'scale'

export interface QuestionOption {
  id: string
  label: string
  followUp?: string // ID of a follow-up question to show
}

export interface ConditionalRule {
  questionId: string
  value: string
}

export interface Question {
  id: string
  type: QuestionType
  question: string
  required: boolean
  options?: QuestionOption[]
  multiSelect?: boolean
  maxSelections?: number
  instruction?: string
  conditional?: ConditionalRule
  // scale-specific
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
  minEmoji?: string
  maxEmoji?: string
}

export interface Section {
  id: string
  title: string
  questions: Question[]
}

export interface Questionnaire {
  id: string
  label: string
  tagline: string
  description: string
  estimatedMinutes: number
  sections: Section[]
}

export interface QuestionnaireData {
  version: string
  lastUpdated: string
  renderModes: string[]
  stakeholders: Questionnaire[]
}

export type RenderMode = 'form' | 'poll' | 'conversational'

export type Answers = Record<string, string | string[] | number>

export interface QuestionnaireRendererProps {
  questionnaire: Questionnaire
  mode: RenderMode
  onComplete: (answers: Answers) => void
  onSkip?: () => void
}
