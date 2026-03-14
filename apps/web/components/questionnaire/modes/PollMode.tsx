'use client'

import React, { useState, useEffect } from 'react'
import type { Questionnaire, Answers } from '../types'
import { useQuestionnaire } from '../useQuestionnaire'
import { QuestionnaireProgress } from '../QuestionnaireProgress'
import { QuestionRenderer } from '../QuestionRenderer'
import { QuestionnaireComplete } from '../QuestionnaireComplete'

interface PollModeProps {
  questionnaire: Questionnaire
  onComplete: (answers: Answers) => void
  onSkip?: () => void
}

export function PollMode({ questionnaire, onComplete, onSkip }: PollModeProps) {
  const {
    answers,
    answer,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    isFirst,
    isLast,
    isCurrentAnswered,
    timeRemaining,
    goNext,
    goPrev,
    clearPersistence,
  } = useQuestionnaire(questionnaire)

  const [completed, setCompleted] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward')

  // Auto-advance for single choice after selection
  const handleAnswer = (questionId: string, value: string | string[] | number) => {
    answer(questionId, value)
    if (currentQuestion?.type === 'single_choice') {
      setTimeout(() => {
        if (isLast) {
          clearPersistence()
          setCompleted(true)
        } else {
          setAnimDir('forward')
          setAnimKey(k => k + 1)
          goNext()
        }
      }, 300)
    }
  }

  const handleManualNext = () => {
    if (isLast) {
      clearPersistence()
      setCompleted(true)
    } else {
      setAnimDir('forward')
      setAnimKey(k => k + 1)
      goNext()
    }
  }

  const handleBack = () => {
    setAnimDir('back')
    setAnimKey(k => k + 1)
    goPrev()
  }

  if (completed) {
    return (
      <div className="looc-poll-complete-wrap">
        <QuestionnaireComplete
          questionnaire={questionnaire}
          answers={answers}
          onContinue={() => onComplete(answers)}
        />
      </div>
    )
  }

  if (!currentQuestion) return null

  const needsManualNext = currentQuestion.type !== 'single_choice'
  const isMultiAnswered = isCurrentAnswered

  return (
    <div className="looc-poll-mode">
      {/* Top bar: skip + dots */}
      <div className="looc-poll-topbar">
        {!isFirst ? (
          <button type="button" className="looc-poll-back-btn" onClick={handleBack} aria-label="Previous question">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <div className="looc-poll-spacer" />
        )}
        <div className="looc-poll-dots-row" role="progressbar" aria-valuenow={currentQuestionIndex + 1} aria-valuemax={totalQuestions}>
          {Array.from({ length: Math.min(totalQuestions, 12) }, (_, i) => (
            <div
              key={i}
              className={`looc-poll-dot ${i === currentQuestionIndex ? 'looc-poll-dot--active' : ''} ${i < currentQuestionIndex ? 'looc-poll-dot--done' : ''}`}
            />
          ))}
          {totalQuestions > 12 && (
            <span className="looc-poll-dot-overflow">+{totalQuestions - 12}</span>
          )}
        </div>
        {onSkip ? (
          <button type="button" className="looc-poll-skip-btn" onClick={onSkip}>Skip</button>
        ) : (
          <div className="looc-poll-spacer" />
        )}
      </div>

      {/* Main question area */}
      <div className="looc-poll-main" key={animKey} data-dir={animDir}>
        <div className="looc-poll-meta">
          <span className="looc-poll-count">{currentQuestionIndex + 1} / {totalQuestions}</span>
          <span className="looc-poll-time">{timeRemaining}</span>
        </div>

        <h2 className="looc-poll-question">{currentQuestion.question}</h2>

        {currentQuestion.instruction && (
          <p className="looc-poll-instruction">{currentQuestion.instruction}</p>
        )}

        <div className="looc-poll-options">
          <QuestionRenderer
            question={currentQuestion}
            answers={answers}
            onAnswer={handleAnswer}
            showQuestionText={false}
          />
        </div>
      </div>

      {/* Bottom CTA for multi / text */}
      {needsManualNext && (
        <div className="looc-poll-footer">
          <button
            type="button"
            className={`looc-poll-next-btn ${!isMultiAnswered ? 'looc-poll-next-btn--disabled' : ''}`}
            onClick={isMultiAnswered ? handleManualNext : undefined}
            disabled={!isMultiAnswered}
          >
            {isLast ? 'Done ✓' : 'Next →'}
          </button>
        </div>
      )}

      <style>{`
        .looc-poll-mode {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--loocbooc-white, #fafafa);
          padding: 0;
        }

        .looc-poll-complete-wrap {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--loocbooc-white, #fafafa);
        }

        /* Top bar */
        .looc-poll-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 20px 0;
          gap: 12px;
        }

        .looc-poll-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--surface-2, #f5f5f5);
          border: none;
          cursor: pointer;
          color: var(--text-primary, #0a0a0a);
          flex-shrink: 0;
          transition: background var(--duration-fast, 150ms);
        }

        .looc-poll-back-btn:hover {
          background: var(--surface-3, #ebebeb);
        }

        .looc-poll-spacer {
          width: 44px;
          flex-shrink: 0;
        }

        .looc-poll-dots-row {
          display: flex;
          gap: 5px;
          align-items: center;
          flex: 1;
          justify-content: center;
          flex-wrap: wrap;
        }

        .looc-poll-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--surface-3, #ebebeb);
          transition: all var(--duration-normal, 250ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
        }

        .looc-poll-dot--done {
          background: var(--text-tertiary, #9ca3af);
          transform: scale(0.8);
        }

        .looc-poll-dot--active {
          background: var(--loocbooc-black, #0a0a0a);
          transform: scale(1.4);
          box-shadow: 0 0 0 3px rgba(10,10,10,0.12);
        }

        .looc-poll-dot-overflow {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-tertiary, #9ca3af);
          font-family: Inter, sans-serif;
        }

        .looc-poll-skip-btn {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-tertiary, #9ca3af);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 0;
          min-width: 44px;
          text-align: right;
        }

        /* Main */
        .looc-poll-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 32px 20px 120px;
          animation: looc-poll-enter var(--duration-normal, 250ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1)) both;
        }

        .looc-poll-main[data-dir="back"] {
          animation-name: looc-poll-enter-back;
        }

        @keyframes looc-poll-enter {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @keyframes looc-poll-enter-back {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .looc-poll-meta {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 20px;
        }

        .looc-poll-count {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-tertiary, #9ca3af);
        }

        .looc-poll-time {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 12px;
          color: var(--text-tertiary, #9ca3af);
        }

        .looc-poll-question {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 22px;
          font-weight: 700;
          line-height: 1.3;
          color: var(--text-primary, #0a0a0a);
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }

        .looc-poll-instruction {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 13px;
          color: var(--text-secondary, #6b7280);
          margin: 0 0 20px;
        }

        .looc-poll-options {
          margin-top: 24px;
        }

        /* Footer CTA */
        .looc-poll-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px 20px 32px;
          background: linear-gradient(to top, var(--loocbooc-white, #fafafa) 75%, transparent);
        }

        .looc-poll-next-btn {
          width: 100%;
          min-height: 56px;
          border-radius: var(--radius-md, 8px);
          background: var(--loocbooc-black, #0a0a0a);
          color: white;
          font-family: Inter, -apple-system, sans-serif;
          font-size: 16px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
        }

        .looc-poll-next-btn:hover:not(.looc-poll-next-btn--disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-4, 0 20px 25px rgba(0,0,0,0.10));
        }

        .looc-poll-next-btn--disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
