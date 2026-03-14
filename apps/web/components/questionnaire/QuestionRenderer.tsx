'use client'

import React from 'react'
import type { Question, Answers } from './types'
import { SingleChoiceQuestion } from './questions/SingleChoiceQuestion'
import { MultiChoiceQuestion } from './questions/MultiChoiceQuestion'
import { TextQuestion } from './questions/TextQuestion'
import { ScaleQuestion } from './questions/ScaleQuestion'

interface QuestionRendererProps {
  question: Question
  answers: Answers
  onAnswer: (questionId: string, value: string | string[] | number) => void
  /** Show the question text above the input (default true) */
  showQuestionText?: boolean
}

export function QuestionRenderer({
  question,
  answers,
  onAnswer,
  showQuestionText = true,
}: QuestionRendererProps) {
  const value = answers[question.id]

  const handleChange = (val: string | string[] | number) => {
    onAnswer(question.id, val)
  }

  return (
    <div className="looc-question-renderer">
      {showQuestionText && (
        <h3 className="looc-question-text">
          {question.question}
          {question.required && (
            <span className="looc-question-required" aria-label="required"> *</span>
          )}
        </h3>
      )}

      <div className="looc-question-input">
        {question.type === 'single_choice' && (
          <SingleChoiceQuestion
            question={question}
            value={typeof value === 'string' ? value : undefined}
            onChange={val => handleChange(val)}
          />
        )}
        {question.type === 'multi_choice' && (
          <MultiChoiceQuestion
            question={question}
            value={Array.isArray(value) ? value : []}
            onChange={val => handleChange(val)}
          />
        )}
        {question.type === 'text' && (
          <TextQuestion
            question={question}
            value={typeof value === 'string' ? value : ''}
            onChange={val => handleChange(val)}
          />
        )}
        {question.type === 'scale' && (
          <ScaleQuestion
            question={question}
            value={typeof value === 'number' ? value : undefined}
            onChange={val => handleChange(val)}
          />
        )}
      </div>

      <style>{`
        .looc-question-renderer {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
        }

        .looc-question-text {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 20px;
          font-weight: 600;
          line-height: 1.35;
          color: var(--text-primary, #0a0a0a);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .looc-question-required {
          color: var(--loocbooc-accent, #c8b49a);
          font-weight: 400;
        }

        .looc-question-input {
          width: 100%;
        }
      `}</style>
    </div>
  )
}
