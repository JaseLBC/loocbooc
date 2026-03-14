'use client'

/**
 * QuestionnaireRenderer
 * ---------------------
 * Main entry point for the Loocbooc stakeholder questionnaire system.
 *
 * Renders a Questionnaire in one of three modes:
 *   - 'form'           → Multi-step form, one section at a time
 *   - 'poll'           → One question at a time, full-screen, fast
 *   - 'conversational' → Chat-style, questions as messages
 *
 * Usage:
 *   <QuestionnaireRenderer
 *     questionnaire={data.stakeholders[0]}
 *     mode="poll"
 *     onComplete={(answers) => console.log(answers)}
 *   />
 */

import React from 'react'
import type { QuestionnaireRendererProps } from './types'
import { FormMode } from './modes/FormMode'
import { PollMode } from './modes/PollMode'
import { ConversationalMode } from './modes/ConversationalMode'

export type { Questionnaire, QuestionnaireRendererProps, RenderMode, Answers } from './types'

export function QuestionnaireRenderer({
  questionnaire,
  mode,
  onComplete,
  onSkip,
}: QuestionnaireRendererProps) {
  switch (mode) {
    case 'form':
      return (
        <FormMode
          questionnaire={questionnaire}
          onComplete={onComplete}
          onSkip={onSkip}
        />
      )

    case 'poll':
      return (
        <PollMode
          questionnaire={questionnaire}
          onComplete={onComplete}
          onSkip={onSkip}
        />
      )

    case 'conversational':
      return (
        <ConversationalMode
          questionnaire={questionnaire}
          onComplete={onComplete}
          onSkip={onSkip}
        />
      )

    default: {
      // TypeScript exhaustiveness check — ensures all modes are handled
      const exhaustiveCheck: never = mode
      void exhaustiveCheck
      return null
    }
  }
}
