'use client'

import React from 'react'
import type { Question } from '../types'

interface ScaleQuestionProps {
  question: Question
  value: number | undefined
  onChange: (value: number) => void
}

export function ScaleQuestion({ question, value, onChange }: ScaleQuestionProps) {
  const min = question.min ?? 1
  const max = question.max ?? 5
  const minEmoji = question.minEmoji ?? '😕'
  const maxEmoji = question.maxEmoji ?? '🤩'
  const minLabel = question.minLabel ?? 'Not at all'
  const maxLabel = question.maxLabel ?? 'Absolutely'

  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  return (
    <div className="looc-scale-question">
      {/* Scale buttons */}
      <div className="looc-scale-track" role="group" aria-label={question.question}>
        {steps.map((step) => {
          const selected = value === step
          const filled = value !== undefined && step <= value
          return (
            <button
              key={step}
              type="button"
              className={`looc-scale-pip ${selected ? 'looc-scale-pip--selected' : ''} ${filled ? 'looc-scale-pip--filled' : ''}`}
              onClick={() => onChange(step)}
              aria-label={`${step} out of ${max}`}
              aria-pressed={selected}
            >
              <span className="looc-scale-pip-number">{step}</span>
            </button>
          )
        })}
      </div>

      {/* Labels */}
      <div className="looc-scale-labels">
        <div className="looc-scale-label-end">
          <span className="looc-scale-emoji">{minEmoji}</span>
          <span className="looc-scale-label-text">{minLabel}</span>
        </div>
        <div className="looc-scale-label-end looc-scale-label-end--right">
          <span className="looc-scale-emoji">{maxEmoji}</span>
          <span className="looc-scale-label-text">{maxLabel}</span>
        </div>
      </div>

      <style>{`
        .looc-scale-question {
          width: 100%;
        }

        .looc-scale-track {
          display: flex;
          gap: 8px;
          justify-content: center;
          align-items: center;
          padding: 16px 0;
        }

        .looc-scale-pip {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md, 8px);
          border: 1.5px solid var(--surface-3, #ebebeb);
          background: var(--surface-1, #ffffff);
          cursor: pointer;
          transition: all var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
          box-shadow: var(--shadow-1, 0 1px 3px rgba(0,0,0,0.08));
          flex-shrink: 0;
        }

        .looc-scale-pip:hover {
          border-color: var(--loocbooc-accent, #c8b49a);
          transform: translateY(-2px) scale(1.05);
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
        }

        .looc-scale-pip--filled {
          background: var(--surface-2, #f5f5f5);
          border-color: var(--surface-3, #ebebeb);
        }

        .looc-scale-pip--selected {
          background: var(--loocbooc-black, #0a0a0a);
          border-color: var(--loocbooc-black, #0a0a0a);
          transform: translateY(-3px) scale(1.1);
          box-shadow: var(--shadow-3, 0 10px 15px rgba(0,0,0,0.10));
        }

        .looc-scale-pip-number {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-secondary, #6b7280);
          transition: color var(--duration-fast, 150ms);
        }

        .looc-scale-pip--filled .looc-scale-pip-number {
          color: var(--text-primary, #0a0a0a);
        }

        .looc-scale-pip--selected .looc-scale-pip-number {
          color: var(--text-inverse, #fafafa);
        }

        .looc-scale-labels {
          display: flex;
          justify-content: space-between;
          padding: 8px 4px 0;
        }

        .looc-scale-label-end {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          max-width: 40%;
        }

        .looc-scale-label-end--right {
          align-items: flex-end;
          text-align: right;
        }

        .looc-scale-emoji {
          font-size: 20px;
          line-height: 1;
        }

        .looc-scale-label-text {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: var(--text-tertiary, #9ca3af);
          line-height: 1.4;
        }

        @media (max-width: 375px) {
          .looc-scale-pip {
            width: 40px;
            height: 40px;
          }
          .looc-scale-track {
            gap: 4px;
          }
        }
      `}</style>
    </div>
  )
}
