<template>
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal-card">
      <div class="modal-layout">
        <section class="video-section">
          <div class="video-stage">
            <video
              v-show="isSessionActive && isVideoReady"
              ref="videoRef"
              class="digital-human-video"
              autoplay
              playsinline
            ></video>
            <div
              v-if="!isVideoReady"
              class="video-placeholder"
              role="status"
              aria-live="polite"
            >
              <div class="placeholder-figure">
                <img :src="placeholderPortrait" alt="Digital interviewer placeholder" />
              </div>
              <div class="placeholder-status">
                <span class="loading-spinner" aria-hidden="true"></span>
                <p>{{ statusInfo.message }}</p>
                <span class="status-hint">Preparing your digital interviewer...</span>
              </div>
            </div>
            <button
              v-if="!hasEmittedComplete && isSessionActive"
              class="end-call"
              type="button"
              @click="handleHangUp"
            >
              <span class="end-call-icon" aria-hidden="true">📞</span>
              <span class="end-call-label">Hang Up</span>
            </button>
            <div class="status-foot">
              <div class="status-indicator" :title="statusInfo.message">
                <span
                  class="status-dot"
                  :class="`status-dot-${statusInfo.key}`"
                  aria-hidden="true"
                ></span>
                <span class="sr-only">{{ statusInfo.message }}</span>
              </div>
              <div v-if="errorMessage || licenseMissing" class="alert-stack" role="status">
                <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
                <p v-if="licenseMissing" class="warning-message">
                  Update <code>src/config/navtalk.ts</code> with a valid LICENSE before starting an interview.
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside class="job-section">
          <header class="job-header">
            <div class="job-badge">{{ jobInitials }}</div>
            <div class="job-heading">
              <div class="job-title-row">
                <h2>{{ props.job.title }}</h2>
                <span v-if="props.job.employmentType" class="job-tag">{{ props.job.employmentType }}</span>
              </div>
              <p v-if="props.job.companyName" class="job-company">{{ props.job.companyName }}</p>
            </div>
          </header>

          <ul class="job-meta">
            <li v-if="props.job.location">
              <span class="meta-label">Location</span>
              <span class="meta-value">{{ props.job.location }}</span>
            </li>
            <li v-if="props.job.salaryRange">
              <span class="meta-label">Base pay range</span>
              <span class="meta-value">{{ props.job.salaryRange }}</span>
            </li>
          </ul>

          <div v-if="props.job.summary" class="job-summary">
            <h3>Role Overview</h3>
            <p>{{ props.job.summary }}</p>
          </div>

          <div v-if="jobRequirements.length" class="job-requirements">
            <h3>Key Requirements</h3>
            <ul>
              <li v-for="(item, index) in jobRequirements" :key="index">{{ item }}</li>
            </ul>
          </div>
        </aside>
      </div>
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
  NAVTALK_CLOSING_MESSAGE,
  NAVTALK_STATUS_MESSAGES,
  buildInterviewPrompt,
} from '../config/navtalk'
import placeholderPortrait from '../assets/interviewer-avatar.png'

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
const closingFallbackMessage = NAVTALK_CLOSING_MESSAGE
const isVideoReady = ref(false)
let closingRequested = false
let closingReceived = false
let resolveClosingPromise: (() => void) | null = null
let closingTimeoutHandle: ReturnType<typeof setTimeout> | null = null
let cleanupVideoEvents: (() => void) | null = null

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
const currentQuestion = computed(() => props.job.questions[currentQuestionIndex.value] ?? null)

const isSessionActive = computed(() => currentStatus.value !== 'idle' && currentStatus.value !== 'stopped')
const statusInfo = computed(() => mapStatusInfo(currentStatus.value))

type StatusDisplayKey = 'connecting' | 'connected' | 'failed'

const STATUS_DISPLAY_MESSAGES: Record<StatusDisplayKey, string> = NAVTALK_STATUS_MESSAGES

const jobRequirements = computed(() =>
  (props.job.requirements ?? [])
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item && item.length > 0))
)

const jobInitials = computed(() => {
  const words = (props.job.title ?? '').split(' ').filter(Boolean)
  if (!words.length) {
    return 'JD'
  }
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
})

function mapStatusInfo(status: NavtalkSessionStatus): { key: StatusDisplayKey; message: string } {
  switch (status) {
    case 'idle':
    case 'connecting':
      return { key: 'connecting', message: STATUS_DISPLAY_MESSAGES.connecting }
    case 'connected':
    case 'ready':
    case 'listening':
    case 'speaking':
      return { key: 'connected', message: STATUS_DISPLAY_MESSAGES.connected }
    case 'stopped':
      return { key: 'connected', message: STATUS_DISPLAY_MESSAGES.connected }
    case 'error':
    default:
      return { key: 'failed', message: STATUS_DISPLAY_MESSAGES.failed }
  }
}

watch(
  () => props.job.id,
  () => {
    restartSession()
  },
  { immediate: true }
)

watch(
  () => videoRef.value,
  (video) => {
    if (cleanupVideoEvents) {
      cleanupVideoEvents()
      cleanupVideoEvents = null
    }

    if (!video) {
      isVideoReady.value = false
      return
    }

    const markReady = () => {
      isVideoReady.value = true
    }

    const markNotReady = () => {
      isVideoReady.value = false
    }

    video.addEventListener('loadeddata', markReady)
    video.addEventListener('playing', markReady)
    video.addEventListener('waiting', markNotReady)
    video.addEventListener('stalled', markNotReady)
    video.addEventListener('emptied', markNotReady)

    cleanupVideoEvents = () => {
      video.removeEventListener('loadeddata', markReady)
      video.removeEventListener('playing', markReady)
      video.removeEventListener('waiting', markNotReady)
      video.removeEventListener('stalled', markNotReady)
      video.removeEventListener('emptied', markNotReady)
    }
  },
  { immediate: true }
)

watch(currentStatus, (status) => {
  if (status === 'idle' || status === 'connecting' || status === 'stopped' || status === 'error') {
    isVideoReady.value = false
  }
})

onBeforeUnmount(async () => {
  await stopSession()
  if (cleanupVideoEvents) {
    cleanupVideoEvents()
    cleanupVideoEvents = null
  }
})

async function restartSession() {
  await stopSession()
  resetState()
  await startSession()
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

async function finalizeInterview(options: { immediate?: boolean } = {}) {
  const { immediate = false } = options

  if (hasEmittedComplete.value) {
    return
  }
  hasEmittedComplete.value = true

  if (immediate) {
    resetClosingState()

    const lastTurn = conversation.value[conversation.value.length - 1]
    if (!lastTurn || lastTurn.speaker !== 'interviewer' || lastTurn.message !== closingFallbackMessage) {
      conversation.value = [
        ...conversation.value,
        { speaker: 'interviewer', message: closingFallbackMessage },
      ]
    }

    await stopSession()

    emit('complete', {
      conversation: [...conversation.value],
      answers: [...answers.value],
      completedAt: new Date().toISOString(),
    })
    return
  }

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

  await stopSession()

  emit('complete', {
    conversation: [...conversation.value],
    answers: [...answers.value],
    completedAt: new Date().toISOString(),
  })
}


async function handleHangUp() {
  if (hasEmittedComplete.value) {
    return
  }

  if (!session.value) {
    await stopSession()
    resetState()
    emit('cancel')
    return
  }

  await finalizeInterview({ immediate: true })
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
  isVideoReady.value = false
  resetClosingState()
}
</script>

<style scoped>
.modal-overlay {
  --modal-padding: clamp(0.75rem, 1.8vw, 1.5rem);
  position: fixed;
  inset: 0;
  background: rgba(6, 12, 32, 0.72);
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: var(--modal-padding);
  z-index: 1000;
}

.modal-card {
  width: min(1080px, 96vw);
  height: calc(100vh - (var(--modal-padding) * 2));
  max-height: calc(100vh - (var(--modal-padding) * 2));
  background: radial-gradient(circle at top, #12152e, #090b1d);
  color: #f5f6ff;
  border-radius: 24px;
  padding: clamp(1.5rem, 2.4vw, 2.3rem);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-layout {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1.5rem, 2.5vw, 2.5rem);
  min-height: 0;
  align-items: stretch;
}

.video-section {
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 1.8vw, 1.4rem);
  min-height: 0;
  position: relative;
}

.video-stage {
  position: relative;
  flex: 1;
  border-radius: 28px;
  overflow: hidden;
  background: #020617;
  box-shadow: 0 18px 32px rgba(8, 12, 32, 0.45);
}

.digital-human-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(1.4rem, 3vw, 2rem);
  padding: clamp(1.8rem, 4vw, 2.5rem);
  text-align: center;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(8, 11, 24, 0.95));
  color: rgba(226, 232, 240, 0.86);
  font-size: clamp(0.95rem, 1.6vw, 1.05rem);
  line-height: 1.6;
}

.placeholder-figure {
  width: min(220px, 45%);
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 20%, rgba(79, 70, 229, 0.45), rgba(30, 27, 75, 0.85));
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.25), 0 24px 48px rgba(2, 6, 23, 0.4);
}

.placeholder-figure img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.05);
}

.placeholder-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.placeholder-status p {
  margin: 0;
  font-size: clamp(1rem, 1.8vw, 1.1rem);
  font-weight: 600;
  color: rgba(248, 250, 252, 0.95);
  letter-spacing: 0.03em;
}

.status-hint {
  font-size: clamp(0.85rem, 1.5vw, 0.95rem);
  color: rgba(203, 213, 225, 0.85);
  letter-spacing: 0.02em;
}

.loading-spinner {
  width: clamp(46px, 10vw, 58px);
  height: clamp(46px, 10vw, 58px);
  border-radius: 50%;
  border: 3px solid rgba(148, 163, 184, 0.3);
  border-top-color: rgba(129, 140, 248, 0.9);
  border-right-color: rgba(99, 102, 241, 0.65);
  animation: placeholder-spin 1s linear infinite;
}

@keyframes placeholder-spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.end-call {
  position: absolute;
  left: 50%;
  bottom: clamp(1rem, 2.4vw, 1.8rem);
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.65rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #f87171, #dc2626);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 14px 28px rgba(239, 68, 68, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.end-call:hover,
.end-call:focus-visible {
  transform: translateX(-50%) scale(1.02);
  box-shadow: 0 16px 32px rgba(239, 68, 68, 0.45);
}

.end-call:focus-visible {
  outline: 2px solid rgba(248, 113, 113, 0.8);
  outline-offset: 4px;
}

.end-call-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  font-size: 1.05rem;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.end-call:hover .end-call-icon,
.end-call:focus-visible .end-call-icon {
  background: rgba(255, 255, 255, 0.25);
}

.status-foot {
  position: absolute;
  left: clamp(1rem, 2.3vw, 1.6rem);
  bottom: clamp(1rem, 2.3vw, 1.6rem);
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
}

.status-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: #64748b;
  box-shadow: 0 0 0 4px rgba(100, 116, 139, 0.18);
}

.status-dot-connecting {
  background: #38bdf8;
  box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.18);
}

.status-dot-connected {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
}

.status-dot-failed {
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.18);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.alert-stack {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  pointer-events: auto;
}

.error-message {
  margin: 0;
  font-size: 0.82rem;
  color: #fca5a5;
}

.warning-message {
  margin: 0;
  font-size: 0.82rem;
  color: #fcd34d;
}

.job-section {
  display: flex;
  flex-direction: column;
  gap: clamp(1.2rem, 2.2vw, 1.6rem);
  padding: clamp(1.5rem, 2.3vw, 2.1rem);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(9, 12, 28, 0.92));
  border-radius: 28px;
  box-shadow: 0 18px 32px rgba(8, 12, 32, 0.45);
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable both-edges;
}

.job-section::-webkit-scrollbar {
  width: 6px;
}

.job-section::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.35);
  border-radius: 999px;
}

.job-section::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.45);
  border-radius: 999px;
}

.job-header {
  display: flex;
  align-items: center;
  gap: clamp(1rem, 2vw, 1.4rem);
  margin-bottom: clamp(1.2rem, 2vw, 1.6rem);
}

.job-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(3.25rem, 5vw, 3.75rem);
  aspect-ratio: 1;
  border-radius: 18px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 12px 24px rgba(99, 102, 241, 0.35);
  font-weight: 600;
  letter-spacing: 0.08em;
  font-size: clamp(1.1rem, 1.9vw, 1.35rem);
  text-transform: uppercase;
}

.job-heading {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.job-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.job-title-row h2 {
  margin: 0;
  font-size: clamp(1.35rem, 2.2vw, 1.6rem);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.job-tag {
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  background: rgba(129, 140, 248, 0.18);
  color: rgba(226, 232, 240, 0.9);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.job-company {
  margin: 0;
  color: rgba(226, 232, 240, 0.78);
  font-size: 0.95rem;
}

.job-meta {
  list-style: none;
  margin: 0 0 clamp(1.3rem, 2.2vw, 1.6rem);
  padding: 0;
  display: grid;
  gap: 0.85rem;
}

.job-meta li {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.meta-label {
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  color: rgba(148, 163, 184, 0.7);
}

.meta-value {
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.95);
  font-weight: 500;
}

.job-summary,
.job-requirements {
  background: rgba(15, 23, 42, 0.55);
  border-radius: 20px;
  padding: clamp(1rem, 1.8vw, 1.35rem);
  box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.08);
}

.job-summary + .job-requirements {
  margin-top: clamp(1rem, 1.8vw, 1.35rem);
}

.job-summary h3,
.job-requirements h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(248, 250, 252, 0.92);
}

.job-summary p {
  margin: 0;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.88);
  font-size: 0.96rem;
}

.job-requirements ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.6rem;
}

.job-requirements li {
  position: relative;
  padding-left: 1.1rem;
  font-size: 0.93rem;
  line-height: 1.5;
  color: rgba(226, 232, 240, 0.88);
}

.job-requirements li::before {
  content: '';
  position: absolute;
  left: 0.25rem;
  top: 0.6rem;
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.65);
  box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.12);
}

@media (max-width: 1100px) {
  .modal-card {
    width: min(860px, 96vw);
  }

  .modal-layout {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(0, 1fr);
  }

  .video-stage {
    min-height: clamp(320px, 56vh, 560px);
  }

  .job-section {
    min-height: clamp(320px, 46vh, 520px);
  }

  .status-foot {
    left: clamp(0.9rem, 2.3vw, 1.5rem);
    bottom: clamp(0.9rem, 2.3vw, 1.5rem);
  }
}

@media (max-width: 720px) {
  .modal-card {
    width: min(560px, 96vw);
    border-radius: 20px;
    padding: clamp(1.25rem, 3vw, 1.6rem);
  }

  .modal-layout {
    gap: 1.5rem;
  }

  .video-stage {
    min-height: clamp(280px, 55vh, 520px);
  }

  .job-section {
    padding: clamp(1.1rem, 3vw, 1.5rem);
  }

  .end-call {
    bottom: clamp(0.85rem, 2.5vw, 1.2rem);
  }

  .placeholder-figure {
    width: min(200px, 60vw);
  }

  .placeholder-status {
    gap: 0.65rem;
  }
}

@media (max-width: 520px) {
  .modal-overlay {
    align-items: stretch;
    padding: 0;
  }

  .modal-card {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    padding: clamp(1rem, 4vw, 1.4rem);
  }

  .modal-layout {
    gap: 1.25rem;
  }

  .video-stage {
    min-height: clamp(220px, 48vh, 380px);
  }

  .job-section {
    padding: clamp(0.95rem, 4vw, 1.3rem);
  }

  .job-summary,
  .job-requirements {
    border-radius: 16px;
  }

  .status-foot {
    left: clamp(0.8rem, 3vw, 1.1rem);
    right: clamp(0.8rem, 3vw, 1.1rem);
    bottom: clamp(0.8rem, 3vw, 1.1rem);
  }

  .placeholder-figure {
    width: min(180px, 68vw);
  }

  .status-hint {
    font-size: clamp(0.8rem, 3.4vw, 0.9rem);
  }
}

@media (max-height: 640px) {
  .modal-overlay {
    align-items: stretch;
  }

  .modal-card {
    border-radius: 20px;
  }

  .video-stage {
    min-height: clamp(260px, 50vh, 460px);
  }
}
</style>
