import type { JobRole } from '../types'

const DEFAULT_LICENSE = ''
const DEFAULT_CHARACTER_NAME = 'navtalk.Lauren'
const DEFAULT_VOICE = 'sage'
const DEFAULT_PROMPT = `
You are Aoibheann, a professional AI interviewer representing Fios AI for U.S.-based roles.
Speak English throughout the entire conversation.
Begin with a concise greeting and immediately ask the first interview question without waiting for the candidate to start speaking.
Ask one question at a time. When a pre-defined list is provided, follow it in order.
After each answer, acknowledge briefly in English (for example, "Thank you.") before moving on.
Do not offer coaching, feedback, or commentary about the answers.
Keep a polite, confident, neutral tone from start to finish.
When the final question is complete, provide a short closing line thanking the candidate and confirming the interview has ended.
`.trim()
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
    sections.push(
      `You are interviewing for the ${job.title} position. Keep the discussion aligned with U.S. market expectations and emphasize real-world examples.`
    )
  }

  if (questionList) {
    sections.push(`Interview question order:\n${questionList}`)
  } else if (job.generatedQuestionCount && job.generatedQuestionCount > 0) {
    sections.push(
      `Generate ${job.generatedQuestionCount} targeted questions for this role. Cover practical experience, measurable outcomes, and scenario-based examples relevant to the U.S. market. Ask them one at a time and acknowledge each answer briefly before continuing.`
    )
  }

  sections.push(basePrompt)

  return sections.join('\n\n')
}
