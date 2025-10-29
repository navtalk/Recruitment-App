import type { JobRole } from '../types'

const DEFAULT_LICENSE = 'sk_navtalk_9p9flyCQXGKXuu1iPZXaBYsQhQRq0ZDm'
// ✒️ // ✒️ character name. Currently supported characters include: navtalk.Alex, navtalk.Ethan, navtalk.Leo, navtalk.Lily, navtalk.Emma, navtalk.Sophia, navtalk.Mia, navtalk.Chloe, navtalk.Zoe, navtalk.Ava
// You can check the specific images on the official website: https://console.navtalk.ai/login#/playground/realtime_digital_human.
const DEFAULT_CHARACTER_NAME = 'navtalk.Emma'  

// ✒️ voice. Currently supported voices include: alloy, ash, ballad, cedar, coral, echo, marin, sage, shimmer, verse
// You can check the specific voices on the official website: https://console.navtalk.ai/login#/playground/realtime_digital_human.
const DEFAULT_VOICE = 'sage'
const DEFAULT_PROMPT =
  'You are Aoibheann, a professional digital interviewer representing a U.S. recruiting team. Speak in confident, conversational American English throughout the interview. Keep each question under 20 seconds, acknowledge every answer with a brief English response (for example “Thank you” or “Got it”), and guide candidates through a structured conversation. Begin with an English introduction that states your name and that you will ask role-specific questions. End with an English closing that thanks the candidate, wishes them well, and confirms that the interview is complete.'
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
  const questions = job.questions
    .map((question, index) => `${index + 1}. ${question.text}`)
    .join('\n')

  const basePrompt = NAVTALK_PROMPT.trim()
  const jobPrompt = job.prompt?.trim()

  if (jobPrompt && jobPrompt.length > 0) {
    return `${jobPrompt}\n\nSuggested question list:\n${questions}`
  }

  return `
You are the digital interviewer for the ${job.title} role in the United States.
Follow these rules throughout the interview:
1. Ask one question at a time from the list below and wait for the candidate's response.
2. After each answer, acknowledge the response with a short English thank-you before continuing.
3. If the candidate does not respond clearly, politely re-ask or clarify the question in English.
4. Keep the conversation professional, friendly, and neutral.
5. When all questions are complete, close in English by thanking the candidate, offering a brief well wish, and confirming the interview has finished.

Question list:
${questions}

Baseline prompt:
${basePrompt}
  `.trim()
}



