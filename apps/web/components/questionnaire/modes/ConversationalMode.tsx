'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { Questionnaire, Question, Answers } from '../types'
import { useQuestionnaire } from '../useQuestionnaire'
import { QuestionnaireComplete } from '../QuestionnaireComplete'

interface ConversationalModeProps {
  questionnaire: Questionnaire
  onComplete: (answers: Answers) => void
  onSkip?: () => void
}

type MessageRole = 'agent' | 'user'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  questionId?: string
  isTyping?: boolean
}

// Format an answer for display in the chat
function formatAnswer(question: Question, value: string | string[] | number): string {
  if (Array.isArray(value)) {
    const labels = value
      .map(id => question.options?.find(o => o.id === id)?.label)
      .filter(Boolean) as string[]
    if (labels.length === 0) return '—'
    if (labels.length === 1) return labels[0]
    if (labels.length === 2) return labels.join(' and ')
    return labels.slice(0, -1).join(', ') + ', and ' + labels[labels.length - 1]
  }
  if (typeof value === 'string') {
    const opt = question.options?.find(o => o.id === value)
    return opt?.label ?? value
  }
  return String(value)
}

export function ConversationalMode({ questionnaire, onComplete, onSkip }: ConversationalModeProps) {
  const {
    answers,
    answer,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    isLast,
    clearPersistence,
  } = useQuestionnaire(questionnaire)

  const [completed, setCompleted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agentTyping, setAgentTyping] = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState<string | string[] | null>(null)
  const [confirmedQuestions, setConfirmedQuestions] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, agentTyping])

  // Init: add greeting + first question
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const greeting = `Hi there! I'm going to ask you a few quick questions to personalise your Loocbooc experience. It'll only take about ${questionnaire.estimatedMinutes} minutes. Let's go!`

    setAgentTyping(true)
    setTimeout(() => {
      setAgentTyping(false)
      setMessages([{
        id: 'greeting',
        role: 'agent',
        content: greeting,
      }])

      if (currentQuestion) {
        setTimeout(() => {
          setAgentTyping(true)
          setTimeout(() => {
            setAgentTyping(false)
            setMessages(prev => [...prev, {
              id: `q-${currentQuestion.id}`,
              role: 'agent',
              content: currentQuestion.question,
              questionId: currentQuestion.id,
            }])
          }, 700)
        }, 400)
      }
    }, 800)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When question changes, add the new question message
  const prevQuestionId = useRef<string | null>(null)
  useEffect(() => {
    if (!currentQuestion) return
    if (currentQuestion.id === prevQuestionId.current) return
    if (!initialized.current) return
    if (currentQuestionIndex === 0) return // Already added in init

    prevQuestionId.current = currentQuestion.id

    setAgentTyping(true)
    setTimeout(() => {
      setAgentTyping(false)
      setMessages(prev => [...prev, {
        id: `q-${currentQuestion.id}`,
        role: 'agent',
        content: currentQuestion.question,
        questionId: currentQuestion.id,
      }])
    }, 600)
  }, [currentQuestion?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle user selecting an option
  const handleAnswer = (questionId: string, value: string | string[] | number) => {
    answer(questionId, value)
    if (currentQuestion?.type === 'single_choice') {
      // For single choice, confirm immediately and move on
      const displayText = formatAnswer(currentQuestion, value)
      commitAnswer(questionId, value as string | string[], displayText)
    }
    // For multi / text, they click "Send"
  }

  const commitAnswer = useCallback((questionId: string, value: string | string[], displayText: string) => {
    if (confirmedQuestions.has(questionId)) return
    setConfirmedQuestions(prev => new Set(prev).add(questionId))

    setMessages(prev => [...prev, {
      id: `a-${questionId}-${Date.now()}`,
      role: 'user',
      content: displayText,
    }])

    if (isLast) {
      setTimeout(() => {
        clearPersistence()
        setCompleted(true)
      }, 500)
    }
  }, [confirmedQuestions, isLast, clearPersistence])

  if (completed) {
    return (
      <div className="looc-conv-complete-wrap">
        <QuestionnaireComplete
          questionnaire={questionnaire}
          answers={answers}
          onContinue={() => onComplete(answers)}
        />
      </div>
    )
  }

  const activeQuestion = currentQuestion

  // Render inline choice options
  const renderReplyOptions = (question: Question) => {
    if (question.type === 'single_choice') {
      const val = answers[question.id] as string | undefined
      return (
        <div className="looc-conv-options">
          {question.options?.map(option => {
            const selected = val === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={`looc-conv-reply-chip ${selected ? 'looc-conv-reply-chip--selected' : ''}`}
                onClick={() => handleAnswer(question.id, option.id)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )
    }

    if (question.type === 'multi_choice') {
      const val = (answers[question.id] as string[] | undefined) ?? []
      const atMax = question.maxSelections !== undefined && val.length >= question.maxSelections
      return (
        <div className="looc-conv-multi-wrap">
          {question.instruction && (
            <p className="looc-conv-instruction">{question.instruction}</p>
          )}
          <div className="looc-conv-options looc-conv-options--multi">
            {question.options?.map(option => {
              const selected = val.includes(option.id)
              const faded = atMax && !selected
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={faded}
                  className={`looc-conv-reply-chip ${selected ? 'looc-conv-reply-chip--selected' : ''} ${faded ? 'looc-conv-reply-chip--faded' : ''}`}
                  onClick={() => {
                    if (faded) return
                    const next = selected ? val.filter(id => id !== option.id) : [...val, option.id]
                    answer(question.id, next)
                  }}
                >
                  {selected && <span className="looc-conv-check">✓</span>}
                  {option.label}
                </button>
              )
            })}
          </div>
          {val.length > 0 && (
            <button
              type="button"
              className="looc-conv-send-btn"
              onClick={() => {
                const displayText = formatAnswer(question, val)
                commitAnswer(question.id, val, displayText)
              }}
            >
              Send →
            </button>
          )}
        </div>
      )
    }

    if (question.type === 'text') {
      const val = (answers[question.id] as string | undefined) ?? ''
      return (
        <div className="looc-conv-text-wrap">
          <div className="looc-conv-text-row">
            <input
              type="text"
              className="looc-conv-text-input"
              value={val}
              onChange={e => answer(question.id, e.target.value)}
              placeholder="Type your answer…"
              onKeyDown={e => {
                if (e.key === 'Enter' && val.trim()) {
                  commitAnswer(question.id, val.trim(), val.trim())
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className={`looc-conv-send-icon ${!val.trim() ? 'looc-conv-send-icon--disabled' : ''}`}
              disabled={!val.trim()}
              onClick={() => {
                if (val.trim()) commitAnswer(question.id, val.trim(), val.trim())
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 9L16 9M16 9L10 3M16 9L10 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="looc-conv-mode">
      {/* Header */}
      <div className="looc-conv-header">
        <div className="looc-conv-avatar">L</div>
        <div className="looc-conv-header-info">
          <span className="looc-conv-name">Loocbooc</span>
          <span className="looc-conv-status">● Online</span>
        </div>
        {onSkip && (
          <button type="button" className="looc-conv-skip" onClick={onSkip}>Skip</button>
        )}
        {/* Progress bar */}
        <div className="looc-conv-progress-bar-wrap">
          <div
            className="looc-conv-progress-bar-fill"
            style={{ width: `${Math.round((currentQuestionIndex / totalQuestions) * 100)}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="looc-conv-messages" role="log" aria-live="polite">
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`looc-conv-msg-row ${msg.role === 'agent' ? 'looc-conv-msg-row--agent' : 'looc-conv-msg-row--user'}`}
            style={{ animationDelay: `${i * 0.02}s` }}
          >
            {msg.role === 'agent' && (
              <div className="looc-conv-msg-avatar">L</div>
            )}
            <div className={`looc-conv-bubble ${msg.role === 'agent' ? 'looc-conv-bubble--agent' : 'looc-conv-bubble--user'}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {agentTyping && (
          <div className="looc-conv-msg-row looc-conv-msg-row--agent">
            <div className="looc-conv-msg-avatar">L</div>
            <div className="looc-conv-bubble looc-conv-bubble--agent looc-conv-bubble--typing">
              <span className="looc-typing-dot" style={{ animationDelay: '0ms' }} />
              <span className="looc-typing-dot" style={{ animationDelay: '160ms' }} />
              <span className="looc-typing-dot" style={{ animationDelay: '320ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Reply area */}
      {activeQuestion && !confirmedQuestions.has(activeQuestion.id) && !agentTyping && (
        <div className="looc-conv-reply-area">
          {renderReplyOptions(activeQuestion)}
        </div>
      )}

      <style>{`
        .looc-conv-mode {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          background: var(--loocbooc-white, #fafafa);
          overflow: hidden;
        }

        .looc-conv-complete-wrap {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--loocbooc-white, #fafafa);
        }

        /* Header */
        .looc-conv-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px 0;
          position: relative;
          flex-shrink: 0;
        }

        .looc-conv-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--loocbooc-black, #0a0a0a);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 18px;
          flex-shrink: 0;
        }

        .looc-conv-header-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .looc-conv-name {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #0a0a0a);
        }

        .looc-conv-status {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 400;
          color: var(--color-success, #22c55e);
        }

        .looc-conv-skip {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-tertiary, #9ca3af);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 0;
        }

        .looc-conv-progress-bar-wrap {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--surface-3, #ebebeb);
          overflow: hidden;
        }

        .looc-conv-progress-bar-fill {
          height: 100%;
          background: var(--loocbooc-black, #0a0a0a);
          border-radius: 1px;
          transition: width var(--duration-slow, 400ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1));
        }

        /* Messages */
        .looc-conv-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 20px 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }

        .looc-conv-msg-row {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          animation: looc-msg-in var(--duration-normal, 250ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1)) both;
        }

        @keyframes looc-msg-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .looc-conv-msg-row--user {
          flex-direction: row-reverse;
        }

        .looc-conv-msg-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--loocbooc-black, #0a0a0a);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 12px;
          flex-shrink: 0;
        }

        .looc-conv-bubble {
          max-width: 78%;
          padding: 12px 16px;
          border-radius: 18px;
          font-family: Inter, -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.5;
        }

        .looc-conv-bubble--agent {
          background: var(--surface-2, #f5f5f5);
          color: var(--text-primary, #0a0a0a);
          border-bottom-left-radius: 6px;
        }

        .looc-conv-bubble--user {
          background: var(--loocbooc-black, #0a0a0a);
          color: var(--text-inverse, #fafafa);
          border-bottom-right-radius: 6px;
          font-weight: 500;
        }

        /* Typing indicator */
        .looc-conv-bubble--typing {
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 14px 18px;
          min-width: 60px;
        }

        .looc-typing-dot {
          display: block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--text-tertiary, #9ca3af);
          animation: looc-typing 1.2s infinite ease-in-out;
        }

        @keyframes looc-typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }

        /* Reply area */
        .looc-conv-reply-area {
          flex-shrink: 0;
          padding: 12px 20px 32px;
          border-top: 1px solid var(--surface-3, #ebebeb);
          background: var(--loocbooc-white, #fafafa);
        }

        .looc-conv-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .looc-conv-options--multi {
          /* same */
        }

        .looc-conv-reply-chip {
          padding: 10px 16px;
          border-radius: var(--radius-full, 9999px);
          border: 1.5px solid var(--surface-3, #ebebeb);
          background: var(--surface-1, #ffffff);
          font-family: Inter, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #0a0a0a);
          cursor: pointer;
          transition: all var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: var(--shadow-1, 0 1px 3px rgba(0,0,0,0.08));
        }

        .looc-conv-reply-chip:hover {
          border-color: var(--loocbooc-accent, #c8b49a);
          transform: translateY(-1px);
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
        }

        .looc-conv-reply-chip--selected {
          background: var(--loocbooc-black, #0a0a0a);
          border-color: var(--loocbooc-black, #0a0a0a);
          color: white;
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
        }

        .looc-conv-reply-chip--faded {
          opacity: 0.3;
          cursor: not-allowed;
          pointer-events: none;
        }

        .looc-conv-check {
          font-size: 12px;
          color: var(--loocbooc-accent, #c8b49a);
        }

        .looc-conv-reply-chip--selected .looc-conv-check {
          color: white;
        }

        .looc-conv-instruction {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 12px;
          color: var(--text-tertiary, #9ca3af);
          margin: 0 0 10px;
        }

        .looc-conv-multi-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .looc-conv-send-btn {
          align-self: flex-start;
          padding: 10px 20px;
          border-radius: var(--radius-full, 9999px);
          background: var(--loocbooc-black, #0a0a0a);
          color: white;
          font-family: Inter, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          min-height: 44px;
          transition: all var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
        }

        .looc-conv-send-btn:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
        }

        /* Text input */
        .looc-conv-text-wrap {
          width: 100%;
        }

        .looc-conv-text-row {
          display: flex;
          gap: 8px;
          align-items: center;
          background: var(--surface-2, #f5f5f5);
          border-radius: var(--radius-full, 9999px);
          padding: 4px 4px 4px 16px;
        }

        .looc-conv-text-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: Inter, -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 400;
          color: var(--text-primary, #0a0a0a);
          min-height: 36px;
          caret-color: var(--loocbooc-accent, #c8b49a);
        }

        .looc-conv-text-input::placeholder {
          color: var(--text-tertiary, #9ca3af);
        }

        .looc-conv-send-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--loocbooc-black, #0a0a0a);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
        }

        .looc-conv-send-icon:hover:not(.looc-conv-send-icon--disabled) {
          transform: scale(1.1);
        }

        .looc-conv-send-icon--disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
