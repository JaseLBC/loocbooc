// ─── Questionnaire System ────────────────────────────────────────────────────
// Public API — import from this file, not from sub-files.

export { QuestionnaireRenderer } from './QuestionnaireRenderer'
export type { Questionnaire, QuestionnaireRendererProps, RenderMode, Answers } from './types'
export type { QuestionType, Question, Section, QuestionOption, ConditionalRule, QuestionnaireData } from './types'

// Individual components (if you need them standalone)
export { QuestionnaireProgress } from './QuestionnaireProgress'
export { QuestionnaireComplete } from './QuestionnaireComplete'
export { QuestionRenderer } from './QuestionRenderer'

// Modes (direct import for code-splitting if needed)
export { FormMode } from './modes/FormMode'
export { PollMode } from './modes/PollMode'
export { ConversationalMode } from './modes/ConversationalMode'

// Question types
export { SingleChoiceQuestion } from './questions/SingleChoiceQuestion'
export { MultiChoiceQuestion } from './questions/MultiChoiceQuestion'
export { TextQuestion } from './questions/TextQuestion'
export { ScaleQuestion } from './questions/ScaleQuestion'

// Hook (if you need custom rendering)
export { useQuestionnaire } from './useQuestionnaire'
