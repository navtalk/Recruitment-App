<template>
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal-card">
      <section class="video-section">
        <div class="video-shell">
          <div class="video-frame">
            <div v-if="!isSessionActive" class="video-placeholder">Connecting to the digital interviewer. Please hold...</div>
            <video
              v-show="isSessionActive"
              ref="videoRef"
              class="digital-human-video"
              autoplay
              playsinline
            ></video>
          </div>
        </div>
        <div class="status-strip">
          <div class="status-bar">
            <span class="status-indicator" :class="statusClass"></span>
            <span>{{ statusMessage }}</span>
          </div>
          <div class="alert-stack">
            <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
            <p v-if="licenseMissing" class="warning-message">
              Update <code>src/config/navtalk.ts</code> with a valid LICENSE before starting an interview.
            </p>
          </div>
        </div>
      </section>

      <button
        v-if="!hasEmittedComplete && isSessionActive"
        class="end-call"
        type="button"
        @click="handleCancel"
      >
        Hang Up
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import type { ConversationTurn, InterviewAnswer, JobRole } from '../types'
import { NavtalkSession, type NavtalkSessionStatus } from '../services/navtalkSession'
import {
  NAVTALK_BASE_URL,
  NAVTALK_CHARACTER_NAME,
  NAVTALK_LICENSE,
  NAVTALK_VOICE,
  buildInterviewPrompt,
} from '../config/navtalk'

const props = defineProps<{
  job: JobRole
  candidateName: { first: string; last: string } | null
}>()

const emit = defineEmits<{
  cancel: []
  complete: [{ conversation: ConversationTurn[]; answers: InterviewAnswer[]; completedAt: string }]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const session = ref<NavtalkSession | null>(null)
const currentStatus = ref<NavtalkSessionStatus>('idle')
const errorMessage = ref<string | null>(null)
const answers = ref<InterviewAnswer[]>([])
const currentQuestionIndex = ref(0)
const hasEmittedComplete = ref(false)
const firstQuestionSpoken = ref(false)
const awaitingAnswer = ref(false)
const conversation = ref<ConversationTurn[]>([])
const lastInterviewerMessage = ref<string | null>(null)
const hasGreeted = ref(false)
const closingFallbackMessage =
  'Thank you for taking the time to speak with me. This concludes the interview.'
let closingRequested = false
let closingReceived = false
let resolveClosingPromise: (() => void) | null = null
let closingTimeoutHandle: ReturnType<typeof setTimeout> | null = null

const licenseMissing = computed(
  () => !NAVTALK_LICENSE || NAVTALK_LICENSE === 'sk_navtalk_your_key'
)

const expectedQuestionCount = computed(() => {
  if (props.job.questions.length > 0) {
    return props.job.questions.length
  }
  return props.job.generatedQuestionCount && props.job.generatedQuestionCount > 0
    ? props.job.generatedQuestionCount
    : 5
})
const answeredCount = computed(() => answers.value.length)
const currentQuestion = computed(() => props.job.questions[currentQuestionIndex.value] ?? null)

const isSessionActive = computed(() => currentStatus.value !== 'idle' && currentStatus.value !== 'stopped')
const statusMessage = computed(() => mapStatusToMessage(currentStatus.value))
const statusClass = computed(() => `status-${currentStatus.value}`)

watch(
  () => props.job.id,
  () => {
    restartSession()
  },
  { immediate: true }
)

watch(answeredCount, (count) => {
  if (count >= expectedQuestionCount.value) {
    finalizeInterview().catch((error) => console.error(error))
  }
})

onBeforeUnmount(async () => {
  await stopSession()
})

async function restartSession() {
  await stopSession()
  resetState()
  await startSession()
}

function mapStatusToMessage(status: NavtalkSessionStatus) {
  switch (status) {
    case 'idle':
      return 'Waiting to connect'
    case 'connecting':
      return 'Connecting to the digital interviewer...'
    case 'connected':
      return 'Connection established. Preparing the session.'
    case 'ready':
      return 'Digital interviewer is ready.'
    case 'listening':
      return 'Listening for the candidate response.'
    case 'speaking':
      return 'Digital interviewer is speaking.'
    case 'stopped':
      return 'Session finished.'
    case 'error':
      return 'Connection error. Please try again.'
    default:
      return 'Updating status...'
  }
}


async function startSession() {
  if (licenseMissing.value) {
    return
  }

  const video = videoRef.value
  const prompt = buildInterviewPrompt(props.job)

  answers.value = []
  conversation.value = []
  currentQuestionIndex.value = 0
  errorMessage.value = null
  hasEmittedComplete.value = false
  firstQuestionSpoken.value = false
  awaitingAnswer.value = false
  lastInterviewerMessage.value = null
  hasGreeted.value = false

  session.value = new NavtalkSession({
    license: NAVTALK_LICENSE,
    characterName: props.job.characterName ?? NAVTALK_CHARACTER_NAME,
    voice: props.job.voice ?? NAVTALK_VOICE,
    baseUrl: NAVTALK_BASE_URL,
    prompt,
    videoElement: video,
    onStatusChange: (status) => {
      currentStatus.value = status
    },
    onUserTranscript: (transcript) => {
      handleUserTranscript(transcript)
    },
    onAssistantPartial: () => {
      currentStatus.value = 'speaking'
    },
    onAssistantComplete: ({ text }) => {
      currentStatus.value = 'connected'
      const trimmed = text.trim()
      if (!trimmed) {
        return
      }

      lastInterviewerMessage.value = trimmed
      conversation.value = [
        ...conversation.value,
        {
          speaker: 'interviewer',
          message: trimmed,
        },
      ]

      if (!hasGreeted.value) {
        hasGreeted.value = true
        return
      }

      if (closingRequested) {
        closingReceived = true
        const resolver = resolveClosingPromise
        resolveClosingPromise = null
        if (resolver) {
          resolver()
        }
        clearClosingTimer()
        closingRequested = false
        return
      }

      if (!firstQuestionSpoken.value) {
        firstQuestionSpoken.value = true
      }

      if (
        answers.value.length === currentQuestionIndex.value &&
        answers.value.length < expectedQuestionCount.value
      ) {
        awaitingAnswer.value = true
      }
    },
    onError: (message) => {
      errorMessage.value = message
      currentStatus.value = 'error'
    },
  })

  try {
    await session.value.start()
  } catch (error) {
    console.error('Failed to start Navtalk session', error)
    errorMessage.value = 'Unable to start the digital interviewer. Please try again.'
    currentStatus.value = 'error'
  }
}

async function stopSession() {
  const current = session.value
  if (!current) {
    resetClosingState()
    currentStatus.value = 'idle'
    return
  }
  session.value = null
  resetClosingState()

  try {
    await current.stop()
  } catch (error) {
    console.error('Failed to stop Navtalk session', error)
  } finally {
    currentStatus.value = 'idle'
  }
}

function handleUserTranscript(transcript: string) {
  const text = transcript.trim()
  if (!text) {
    return
  }

  if (!firstQuestionSpoken.value) {
    return
  }

  conversation.value = [
    ...conversation.value,
    {
      speaker: 'candidate',
      message: text,
    },
  ]

  const questionId = currentQuestion.value?.id ?? `generated-${currentQuestionIndex.value + 1}`
  const questionText = currentQuestion.value?.text ?? lastInterviewerMessage.value ?? ''

  answers.value = [
    ...answers.value,
    {
      questionId,
      questionText,
      answer: text,
    },
  ]

  currentQuestionIndex.value += 1
  awaitingAnswer.value = false
}

function clearClosingTimer() {
  if (closingTimeoutHandle !== null) {
    clearTimeout(closingTimeoutHandle)
    closingTimeoutHandle = null
  }
}

function resetClosingState() {
  clearClosingTimer()
  if (resolveClosingPromise) {
    const resolver = resolveClosingPromise
    resolveClosingPromise = null
    resolver()
  } else {
    resolveClosingPromise = null
  }
  closingRequested = false
  closingReceived = false
}

async function finalizeInterview() {
  if (hasEmittedComplete.value) {
    return
  }
  hasEmittedComplete.value = true
  closingRequested = true
  closingReceived = false

  const closingPromise = new Promise<void>((resolve) => {
    resolveClosingPromise = () => {
      resolveClosingPromise = null
      resolve()
    }
  })

  session.value?.requestAssistantResponse()

  if (typeof window !== 'undefined') {
    closingTimeoutHandle = window.setTimeout(() => {
      closingTimeoutHandle = null
      if (resolveClosingPromise) {
        const resolver = resolveClosingPromise
        resolveClosingPromise = null
        resolver()
      }
    }, 4000)
  }

  try {
    await closingPromise
  } catch (error) {
    console.error('Closing sequence failed', error)
  }

  const delivered = closingReceived
  resetClosingState()

  if (!delivered) {
    conversation.value = [
      ...conversation.value,
      { speaker: 'interviewer', message: closingFallbackMessage },
    ]
  }

  try {
    await session.value?.stop()
  } catch (error) {
    console.error('Failed to stop session during finalize', error)
  } finally {
    emit('complete', {
      conversation: [...conversation.value],
      answers: [...answers.value],
      completedAt: new Date().toISOString(),
    })
  }
}


async function handleCancel() {
  hasEmittedComplete.value = true
  await stopSession()
  resetState()
  emit('cancel')
}

function resetState() {
  answers.value = []
  conversation.value = []
  currentQuestionIndex.value = 0
  errorMessage.value = null
  currentStatus.value = 'idle'
  hasEmittedComplete.value = false
  firstQuestionSpoken.value = false
  awaitingAnswer.value = false
  lastInterviewerMessage.value = null
  hasGreeted.value = false
  resetClosingState()
}
</script>

<style scoped>
.modal-overlay {
  --modal-padding: clamp(0.75rem, 1.8vw, 1.5rem);
  position: fixed;
  inset: 0;
  background: rgba(6, 12, 32, 0.7);
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: var(--modal-padding);
  z-index: 1000;
  overflow: hidden;
}

.modal-card {
  position: relative;
  width: min(660px, 94vw);
  height: calc(100vh - (var(--modal-padding) * 2));
  max-height: calc(100vh - (var(--modal-padding) * 2));
  border-radius: 22px;
  padding: clamp(1.4rem, 2.2vw, 2rem) clamp(1.1rem, 2vw, 1.75rem);
  background: radial-gradient(circle at top, #12152e, #090b1d);
  color: #f5f6ff;
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.4);
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  overflow: hidden;
}

.video-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
}

.video-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: stretch;
  width: 100%;
}

.video-frame {
  position: relative;
  height: 100%;
  width: auto;
  aspect-ratio: 9 / 16;
  max-width: min(100%, calc((100vh - (var(--modal-padding) * 2)) * 0.52));
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(125, 145, 255, 0.28);
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  color: rgba(238, 242, 255, 0.7);
  font-size: 1rem;
  text-align: center;
  background: radial-gradient(circle at center, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95));
}

.digital-human-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: black;
}

.status-indicator {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
}

.status-bar {
  margin-top: 0.5rem;
  align-self: stretch;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: rgba(238, 242, 255, 0.92);
  background: rgba(17, 24, 39, 0.55);
  padding: 0.6rem 1rem;
  border-radius: 16px;
  box-shadow: 0 10px 28px rgba(2, 6, 23, 0.28);
  backdrop-filter: blur(6px);
}

.status-strip {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.alert-stack {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 0;
}

.status-idle {
  background: rgba(148, 163, 184, 0.6);
}

.status-connecting {
  background: rgba(96, 165, 250, 0.8);
}

.status-connected {
  background: rgba(59, 130, 246, 0.85);
}

.status-ready {
  background: rgba(16, 185, 129, 0.8);
}

.status-listening {
  background: rgba(251, 191, 36, 0.85);
}

.status-speaking {
  background: rgba(249, 115, 22, 0.85);
}

.status-stopped {
  background: rgba(107, 114, 128, 0.7);
}

.status-error {
  background: rgba(239, 68, 68, 0.9);
}

.error-message {
  margin: 0;
  color: #fca5a5;
  font-size: 0.9rem;
}

.warning-message {
  margin: 0;
  color: #fbbf24;
  font-size: 0.9rem;
}

.end-call {
  align-self: center;
  padding: 0.85rem 2.5rem;
  border-radius: 999px;
  border: 1px solid rgba(248, 113, 113, 0.4);
  background: rgba(248, 113, 113, 0.18);
  color: #fecaca;
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.end-call:hover {
  transform: translateY(-1px);
  border-color: rgba(248, 113, 113, 0.7);
  box-shadow: 0 12px 28px rgba(248, 113, 113, 0.25);
}

@media (max-width: 720px) {
  .modal-card {
    width: min(560px, 96vw);
    height: calc(100vh - (var(--modal-padding) * 2));
    max-height: calc(100vh - (var(--modal-padding) * 2));
    border-radius: 20px;
  }

  .video-shell {
    align-items: center;
  }

  .video-frame {
    width: 100%;
    height: auto;
    max-width: 100%;
  }

  .end-call {
    width: 100%;
  }
}

@media (max-height: 600px) {
  .modal-overlay {
    align-items: stretch;
  }

  .modal-card {
    height: calc(100vh - (var(--modal-padding) * 2));
    max-height: calc(100vh - (var(--modal-padding) * 2));
  }

  .video-frame {
    flex: 1;
  }
}
</style>
