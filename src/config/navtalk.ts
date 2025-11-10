import type { JobRole } from '../types'

export type InterviewLanguage = 'zh' | 'en'

type LanguagePreset = {
  defaultPrompt: string
  fallbackIntro: (jobTitle: string) => string
  questionListIntro: (questionList: string) => string
  generatedQuestions: (count: number) => string
  closingRemark: string
  statusMessages: Record<'connecting' | 'connected' | 'failed', string>
}

const LANGUAGE_PRESETS: Record<InterviewLanguage, LanguagePreset> = {
  zh: {
      defaultPrompt: `
You are Aoibheann, a professional digital interviewer representing Fios AI.
Conduct the entire conversation in English with the candidate.
After a brief self-introduction, immediately ask the first interview question without waiting for the candidate to speak.
Ask one question at a time; if a fixed question list is provided, follow the order strictly.
After the candidate responds, acknowledge or thank them briefly, then proceed to the next question.
Do not provide guidance, evaluation, or solutions for the answers.
Always maintain a polite, confident, professional, and neutral tone, ensuring the conversation flows smoothly.
At the end of all questions, provide a brief closing remark thanking the candidate and indicating the interview has concluded.
`.trim(),
      fallbackIntro: (jobTitle) =>
          `You are interviewing for the ${jobTitle} role. Focus on the candidate's real experience and measurable results in the context of the U.S. market. Conduct the entire conversation in English.`,
      questionListIntro: (questionList) => `Please ask the following questions in order:\n${questionList}`,
      generatedQuestions: (count) =>
          `Please generate ${count} role-specific questions on the fly, covering practical experience, measurable outcomes, and scenarios relevant to the U.S. market. Ask one question at a time, acknowledge responses briefly in English, and continue.`,
      closingRemark: 'Thank you for taking the time to speak with me. This concludes the interview.',
      statusMessages: {
          connecting: 'Connecting',
          connected: 'Connected successfully',
          failed: 'Connection failed',
      },
  },
  en: {
    defaultPrompt: `
You are Aoibheann, a professional digital interviewer representing Fios AI.
Conduct the entire conversation in English.
After a concise introduction, move straight to the first interview question without waiting for the candidate to speak first.
Ask one question at a time; when a fixed list of questions is provided, follow the sequence precisely.
After each answer, acknowledge briefly in English before proceeding.
Do not coach, evaluate, or provide solutions to the candidate.
Maintain a polite, confident, professional, and neutral tone to keep the dialogue cohesive.
Once all questions are complete, deliver a brief English closing that thanks the candidate and confirms the interview has ended.
`.trim(),
    fallbackIntro: (jobTitle) =>
      `You are interviewing for the ${jobTitle} role. Frame the conversation around the U.S. market, focus on tangible experience and measurable outcomes, and conduct the discussion entirely in English.`,
    questionListIntro: (questionList) =>
      `Ask the following questions in order, one at a time:\n${questionList}`,
    generatedQuestions: (count) =>
      `Generate ${count} targeted questions that align with the role requirements, explore hands-on experience, measurable outcomes, and U.S. market context. Always ask one question at a time, acknowledge each answer briefly in English, then continue.`,
    closingRemark: 'Thank you for your time today. That concludes our interview.',
    statusMessages: {
      connecting: 'Connecting',
      connected: 'Connected',
      failed: 'Connection failed',
    },
  },
}

const DEFAULT_LANGUAGE: InterviewLanguage = 'en'

function normalizeLanguage(value: string | null | undefined): InterviewLanguage {
  if (!value) {
    return DEFAULT_LANGUAGE
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'en' || normalized.startsWith('en')) {
    return 'en'
  }
  return 'zh'
}

export const NAVTALK_LANGUAGE: InterviewLanguage = normalizeLanguage(
  import.meta.env.VITE_NAVTALK_LANGUAGE
)

const ACTIVE_LANGUAGE_PRESET = LANGUAGE_PRESETS[NAVTALK_LANGUAGE]

const DEFAULT_LICENSE = ''
// ✒️ // ✒️ character name. Currently supported characters include: navtalk.Alex, navtalk.Ethan, navtalk.Leo, navtalk.Lily, navtalk.Emma, navtalk.Sophia, navtalk.Mia, navtalk.Chloe, navtalk.Zoe, navtalk.Ava
// You can check the specific images on the official website: https://console.navtalk.ai/login#/playground/realtime_digital_human.
const DEFAULT_CHARACTER_NAME = 'navtalk.Lauren'
// ✒️ voice. Currently supported voices include: alloy, ash, ballad, cedar, coral, echo, marin, sage, shimmer, verse
// You can check the specific voices on the official website: https://console.navtalk.ai/login#/playground/realtime_digital_human.
const DEFAULT_VOICE = 'sage'
const DEFAULT_PROMPT = ACTIVE_LANGUAGE_PRESET.defaultPrompt
const DEFAULT_BASE_URL = 'transfer.navtalk.ai'

export const NAVTALK_LICENSE =
  import.meta.env.VITE_NAVTALK_LICENSE?.trim() ?? DEFAULT_LICENSE
export const NAVTALK_CHARACTER_NAME =
  import.meta.env.VITE_NAVTALK_CHARACTER_NAME?.trim() ?? DEFAULT_CHARACTER_NAME
export const NAVTALK_VOICE =
  import.meta.env.VITE_NAVTALK_VOICE?.trim() ?? DEFAULT_VOICE
export const NAVTALK_PROMPT =
  import.meta.env.VITE_NAVTALK_PROMPT?.trim() ?? DEFAULT_PROMPT
export const NAVTALK_BASE_URL =
  import.meta.env.VITE_NAVTALK_BASE_URL?.trim() ?? DEFAULT_BASE_URL
export const NAVTALK_STATUS_MESSAGES = ACTIVE_LANGUAGE_PRESET.statusMessages
export const NAVTALK_CLOSING_MESSAGE = ACTIVE_LANGUAGE_PRESET.closingRemark

export function buildInterviewPrompt(job: JobRole): string {
  const basePrompt = NAVTALK_PROMPT.trim()
  const jobPrompt = job.prompt?.trim()

  const questionList = job.questions
    .map((question, index) => `${index + 1}. ${question.text}`)
    .join('\n')

  const sections: string[] = []

  if (jobPrompt && jobPrompt.length > 0) {
    sections.push(jobPrompt)
  } else {
    sections.push(ACTIVE_LANGUAGE_PRESET.fallbackIntro(job.title))
  }

  if (questionList) {
    sections.push(ACTIVE_LANGUAGE_PRESET.questionListIntro(questionList))
  } else if (job.generatedQuestionCount && job.generatedQuestionCount > 0) {
    sections.push(ACTIVE_LANGUAGE_PRESET.generatedQuestions(job.generatedQuestionCount))
  }

  sections.push(basePrompt)

  return sections.join('\n\n')
}
