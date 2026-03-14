'use client'

import React from 'react'
import type { Question } from '../types'

interface MultiChoiceQuestionProps {
  question: Question
  value: string[] | undefined
  onChange: (value: string[]) => void
}

export function MultiChoiceQuestion({ question, value = [], onChange }: MultiChoiceQuestionProps) {
  const options = question.options ?? []
  const maxSelections = question.maxSelections
  const atMax = maxSelections !== undefined && value.length >= maxSelections

  const toggle = (optionId: string) => {
    const isSelected = value.includes(optionId)
    if (isSelected) {
      onChange(value.filter(id => id !== optionId))
    } else {
      if (atMax) return // Can't add more
      onChange([...value, optionId])
    }
  }

  const selectionLabel = maxSelections
    ? `${value.length} of ${maxSelections} selected`
    : value.length > 0
    ? `${value.length} selected`
    : null

  return (
    <div className="looc-multi-choice">
      {selectionLabel && (
        <div className="looc-selection-count" aria-live="polite">
          {selectionLabel}
        </div>
      )}
      {question.instruction && (
        <div className="looc-question-instruction">{question.instruction}</div>
      )}

      <div className="looc-options-list" role="group" aria-label={question.question}>
        {options.map((option) => {
          const selected = value.includes(option.id)
          const faded = atMax && !selected

          return (
            <button
              key={option.id}
              role="checkbox"
              aria-checked={selected}
              aria-disabled={faded}
              className={`looc-option-card ${selected ? 'looc-option-card--selected' : ''} ${faded ? 'looc-option-card--faded' : ''}`}
              onClick={() => toggle(option.id)}
              type="button"
              disabled={faded}
            >
              <span className="looc-option-label">{option.label}</span>
              <span
                className={`looc-option-checkbox ${selected ? 'looc-option-checkbox--checked' : ''}`}
                aria-hidden="true"
              >
                {selected ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      <style>{`
        .looc-selection-count {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--loocbooc-accent, #c8b49a);
          letter-spacing: 0.02em;
          text-transform: uppercase;
          margin-bottom: 12px;
          transition: color var(--duration-fast, 150ms);
        }

        .looc-question-instruction {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 13px;
          color: var(--text-secondary, #6b7280);
          margin-bottom: 12px;
        }

        .looc-options-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .looc-option-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          min-height: 52px;
          padding: 14px 16px;
          background: var(--surface-1, #ffffff);
          border: 1.5px solid var(--surface-3, #ebebeb);
          border-radius: var(--radius-md, 8px);
          cursor: pointer;
          text-align: left;
          transition: all var(--duration-fast, 150ms) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));
          box-shadow: var(--shadow-1, 0 1px 3px rgba(0,0,0,0.08));
          position: relative;
        }

        .looc-option-card:hover:not(.looc-option-card--selected):not(.looc-option-card--faded) {
          border-color: var(--loocbooc-accent, #c8b49a);
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
          transform: translateY(-1px);
        }

        .looc-option-card--selected {
          border-color: var(--loocbooc-black, #0a0a0a);
          background: var(--loocbooc-black, #0a0a0a);
          box-shadow: var(--shadow-3, 0 10px 15px rgba(0,0,0,0.10));
          transform: translateY(-1px);
        }

        .looc-option-card--faded {
          opacity: 0.35;
          cursor: not-allowed;
          pointer-events: none;
        }

        .looc-option-label {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.4;
          color: var(--text-primary, #0a0a0a);
          flex: 1;
          transition: color var(--duration-fast, 150ms);
        }

        .looc-option-card--selected .looc-option-label {
          color: var(--text-inverse, #fafafa);
        }

        .looc-option-checkbox {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          border: 1.5px solid var(--surface-3, #ebebeb);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--text-inverse, #fafafa);
          transition: all var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
          margin-left: 12px;
        }

        .looc-option-checkbox--checked {
          background: var(--loocbooc-accent, #c8b49a);
          border-color: transparent;
          transform: scale(1.05);
        }

        @media (hover: none) {
          .looc-option-card:hover:not(.looc-option-card--selected) {
            transform: none;
            box-shadow: var(--shadow-1, 0 1px 3px rgba(0,0,0,0.08));
          }
        }
      `}</style>
    </div>
  )
}
