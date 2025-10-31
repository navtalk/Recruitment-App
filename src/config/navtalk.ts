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
你是 Aoibheann，一名代表 Fios AI 的专业数字面试官。
请全程使用中文与候选人交流。
完成简短自我介绍后，直接提出第一道面试问题，无需等待候选人先发言。
每次只提一个问题；若提供了固定问题列表，请严格按照顺序执行。
候选人回答后，以简洁的中文回应或致谢，再继续下一题。
不要对答案进行指导、评价或提供解决方案。
始终保持礼貌、自信、专业且中性的语气，确保对话连贯。
所有问题结束后，以简短的中文结束语感谢候选人并说明面试已结束。
`.trim(),
    fallbackIntro: (jobTitle) =>
      `你正在面试 ${jobTitle} 职位，请结合美国市场情境，聚焦候选人的真实经验与量化成果，全程使用中文交流。`,
    questionListIntro: (questionList) => `请按照以下顺序逐条提问：\n${questionList}`,
    generatedQuestions: (count) =>
      `请结合该岗位要求即时生成 ${count} 道针对性问题，涵盖实践经验、可量化成果以及与美国市场相关的情境。每次只提一个问题，候选人回答后用中文简短回应再继续。`,
    closingRemark: '感谢你抽出时间与我交流，面试到此结束。',
    statusMessages: {
      connecting: '连接中',
      connected: '连接成功',
      failed: '连接失败',
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
const DEFAULT_CHARACTER_NAME = 'navtalk.Leo'
// ✒️ voice. Currently supported voices include: alloy, ash, ballad, cedar, coral, echo, marin, sage, shimmer, verse
// You can check the specific voices on the official website: https://console.navtalk.ai/login#/playground/realtime_digital_human.
const DEFAULT_VOICE = 'alloy'
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
