'use client'

import React, { useRef, useState } from 'react'
import type { Question } from '../types'

interface TextQuestionProps {
  question: Question
  value: string | undefined
  onChange: (value: string) => void
}

export function TextQuestion({ question, value = '', onChange }: TextQuestionProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasValue = value.length > 0
  const floated = focused || hasValue

  return (
    <div className="looc-text-question">
      <div
        className={`looc-text-field ${focused ? 'looc-text-field--focused' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <label
          className={`looc-text-label ${floated ? 'looc-text-label--floated' : ''}`}
          htmlFor={`q-${question.id}`}
        >
          Your answer
        </label>
        <input
          ref={inputRef}
          id={`q-${question.id}`}
          type="text"
          className="looc-text-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          autoCapitalize="on"
        />
        <div className={`looc-text-underline ${focused ? 'looc-text-underline--active' : ''}`} />
      </div>

      <style>{`
        .looc-text-question {
          width: 100%;
        }

        .looc-text-field {
          position: relative;
          width: 100%;
          background: var(--surface-2, #f5f5f5);
          border-radius: var(--radius-md, 8px);
          padding: 20px 16px 10px;
          cursor: text;
          transition: background var(--duration-fast, 150ms);
          min-height: 60px;
        }

        .looc-text-field--focused {
          background: var(--surface-1, #ffffff);
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
        }

        .looc-text-label {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-family: Inter, -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 400;
          color: var(--text-tertiary, #9ca3af);
          pointer-events: none;
          transition: all var(--duration-normal, 250ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
          transform-origin: left center;
          white-space: nowrap;
        }

        .looc-text-label--floated {
          top: 12px;
          transform: translateY(0) scale(0.82);
          color: var(--loocbooc-accent, #c8b49a);
          font-weight: 500;
        }

        .looc-text-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          font-family: Inter, -apple-system, sans-serif;
          font-size: 16px;
          font-weight: 500;
          color: var(--text-primary, #0a0a0a);
          padding: 0;
          padding-top: 4px;
          line-height: 1.5;
          caret-color: var(--loocbooc-accent, #c8b49a);
        }

        .looc-text-underline {
          position: absolute;
          bottom: 0;
          left: 16px;
          right: 16px;
          height: 2px;
          background: var(--surface-3, #ebebeb);
          border-radius: 1px;
          overflow: hidden;
        }

        .looc-text-underline::after {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--loocbooc-black, #0a0a0a);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform var(--duration-normal, 250ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1));
          border-radius: 1px;
        }

        .looc-text-underline--active::after {
          transform: scaleX(1);
        }
      `}</style>
    </div>
  )
}
