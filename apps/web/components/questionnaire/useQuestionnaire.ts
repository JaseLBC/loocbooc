'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Questionnaire, Answers, Question } from './types'

// ─── Flatten all questions from all sections ─────────────────────────────────
function flattenQuestions(questionnaire: Questionnaire): Question[] {
  return questionnaire.sections.flatMap(section => section.questions)
}

// ─── Check if a question should be shown given current answers ───────────────
function isQuestionVisible(question: Question, answers: Answers): boolean {
  if (!question.conditional) return true
  const { questionId, value } = question.conditional
  const answer = answers[questionId]
  if (Array.isArray(answer)) return answer.includes(value)
  return answer === value
}

// ─── localStorage key ────────────────────────────────────────────────────────
function storageKey(questionnaireId: string) {
  return `loocbooc_questionnaire_${questionnaireId}`
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useQuestionnaire(questionnaire: Questionnaire) {
  const allQuestions = useMemo(() => flattenQuestions(questionnaire), [questionnaire])

  // Load persisted state
  const loadPersistedState = () => {
    try {
      const raw = localStorage.getItem(storageKey(questionnaire.id))
      if (raw) {
        const parsed = JSON.parse(raw) as { answers: Answers; questionIndex: number }
        return parsed
      }
    } catch {
      // ignore
    }
    return null
  }

  const [answers, setAnswers] = useState<Answers>(() => {
    if (typeof window === 'undefined') return {}
    return loadPersistedState()?.answers ?? {}
  })

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return loadPersistedState()?.questionIndex ?? 0
  })

  // Persist to localStorage whenever answers or index changes
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(questionnaire.id),
        JSON.stringify({ answers, questionIndex: currentQuestionIndex })
      )
    } catch {
      // ignore quota errors
    }
  }, [answers, currentQuestionIndex, questionnaire.id])

  // Visible questions (respect conditionals)
  const visibleQuestions = useMemo(
    () => allQuestions.filter(q => isQuestionVisible(q, answers)),
    [allQuestions, answers]
  )

  const currentQuestion = visibleQuestions[currentQuestionIndex] ?? null
  const totalQuestions = visibleQuestions.length
  const isFirst = currentQuestionIndex === 0
  const isLast = currentQuestionIndex === totalQuestions - 1

  // Current section for the current question
  const currentSection = useMemo(() => {
    if (!currentQuestion) return null
    return questionnaire.sections.find(s =>
      s.questions.some(q => q.id === currentQuestion.id)
    ) ?? null
  }, [currentQuestion, questionnaire.sections])

  // Section index
  const currentSectionIndex = useMemo(() => {
    if (!currentSection) return 0
    return questionnaire.sections.indexOf(currentSection)
  }, [currentSection, questionnaire.sections])

  // Answer a question
  const answer = useCallback((questionId: string, value: string | string[] | number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }, [])

  // Navigate
  const goNext = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(i => i + 1)
    }
  }, [currentQuestionIndex, totalQuestions])

  const goPrev = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1)
    }
  }, [currentQuestionIndex])

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentQuestionIndex(index)
    }
  }, [totalQuestions])

  // Clear persisted state after completion
  const clearPersistence = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(questionnaire.id))
    } catch {
      // ignore
    }
  }, [questionnaire.id])

  // Check if current question is answered
  const isCurrentAnswered = useMemo(() => {
    if (!currentQuestion) return false
    if (!currentQuestion.required) return true
    const val = answers[currentQuestion.id]
    if (val === undefined || val === null || val === '') return false
    if (Array.isArray(val)) return val.length > 0
    return true
  }, [currentQuestion, answers])

  // Progress percentage
  const progressPercent = totalQuestions > 0
    ? Math.round((currentQuestionIndex / totalQuestions) * 100)
    : 0

  // Estimated time remaining
  const timeRemaining = useMemo(() => {
    const questionsLeft = totalQuestions - currentQuestionIndex
    const minutesLeft = Math.ceil((questionsLeft / totalQuestions) * questionnaire.estimatedMinutes)
    if (minutesLeft <= 0) return 'Almost done'
    if (minutesLeft === 1) return '~1 min left'
    return `~${minutesLeft} mins left`
  }, [currentQuestionIndex, totalQuestions, questionnaire.estimatedMinutes])

  // Questions grouped by section (for form mode)
  const questionsBySection = useMemo(() => {
    return questionnaire.sections.map(section => ({
      section,
      questions: section.questions.filter(q => isQuestionVisible(q, answers)),
    }))
  }, [questionnaire.sections, answers])

  return {
    answers,
    answer,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    visibleQuestions,
    isFirst,
    isLast,
    isCurrentAnswered,
    currentSection,
    currentSectionIndex,
    progressPercent,
    timeRemaining,
    questionsBySection,
    goNext,
    goPrev,
    goToQuestion,
    clearPersistence,
  }
}
