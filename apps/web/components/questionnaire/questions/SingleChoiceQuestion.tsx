'use client'

import React from 'react'
import type { Question } from '../types'

interface SingleChoiceQuestionProps {
  question: Question
  value: string | undefined
  onChange: (value: string) => void
}

export function SingleChoiceQuestion({ question, value, onChange }: SingleChoiceQuestionProps) {
  const options = question.options ?? []

  return (
    <div className="looc-single-choice" role="radiogroup" aria-label={question.question}>
      <div className="looc-options-list">
        {options.map((option) => {
          const selected = value === option.id
          return (
            <button
              key={option.id}
              role="radio"
              aria-checked={selected}
              className={`looc-option-card ${selected ? 'looc-option-card--selected' : ''}`}
              onClick={() => onChange(option.id)}
              type="button"
            >
              <span className="looc-option-label">{option.label}</span>
              <span className={`looc-option-check ${selected ? 'looc-option-check--visible' : ''}`} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          )
        })}
      </div>

      <style>{`
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
          overflow: hidden;
        }

        .looc-option-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--loocbooc-black, #0a0a0a);
          opacity: 0;
          transition: opacity var(--duration-fast, 150ms) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));
          border-radius: inherit;
        }

        .looc-option-card:hover:not(.looc-option-card--selected) {
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

        .looc-option-card--selected::before {
          opacity: 1;
        }

        .looc-option-label {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.4;
          color: var(--text-primary, #0a0a0a);
          position: relative;
          z-index: 1;
          transition: color var(--duration-fast, 150ms);
        }

        .looc-option-card--selected .looc-option-label {
          color: var(--text-inverse, #fafafa);
        }

        .looc-option-check {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          color: var(--text-inverse, #fafafa);
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: scale(0.5);
          transition: opacity var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
                      transform var(--duration-normal, 250ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
        }

        .looc-option-check--visible {
          opacity: 1;
          transform: scale(1);
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
