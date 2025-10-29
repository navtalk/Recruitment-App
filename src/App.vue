<template>
  <div class="app">
    <header class="hero-banner">
      <span class="hero-chip">AI-powered Screening</span>
      <h1 class="hero-title">U.S. Digital Recruiting Hub</h1>
      <p class="hero-subtitle">Search open roles, launch a live voice interview, and compare transcripts across candidates without leaving the page.</p>
      <div class="hero-meta">
        <span>Voice-led Q&A</span>
        <span>Role-tailored prompts</span>
        <span>Instant transcripts</span>
      </div>
    </header>

    <section class="search-row">
      <input
        v-model="searchQuery"
        class="search-input"
        type="search"
        placeholder="Search by job title, company, or keywords"
        aria-label="Search roles"
      />
    </section>

    <section class="jobs">
      <article v-for="job in filteredJobs" :key="job.id" class="job-card">
        <div class="job-header">
          <div>
            <h2>{{ job.title }}</h2>
            <p class="job-company" v-if="job.companyName || job.location">
              <span v-if="job.companyName">{{ job.companyName }}</span>
              <span v-if="job.companyName && job.location"> &bull; </span>
              <span v-if="job.location">{{ job.location }}</span>
            </p>
          </div>
          <span v-if="job.employmentType" class="job-tag">{{ job.employmentType }}</span>
        </div>

        <p class="job-summary">{{ job.summary }}</p>

        <div class="job-meta">
          <span v-if="job.salaryRange" class="job-salary">{{ job.salaryRange }}</span>
        </div>

        <ul v-if="job.requirements?.length" class="requirements">
          <li v-for="requirement in job.requirements" :key="requirement">{{ requirement }}</li>
        </ul>

        <div class="actions">
          <button
            class="primary"
            type="button"
            @click="handleStartInterview(job)"
            :disabled="isJobCompleted(job.id)"
          >
            {{ isJobCompleted(job.id) ? 'Interview Completed' : 'Start Interview' }}
          </button>
          <button
            class="secondary"
            type="button"
            @click="openRecords(job)"
            :disabled="!recordsByJob[job.id] || recordsByJob[job.id].length === 0"
          >
            View Records
          </button>
        </div>
      </article>

      <p v-if="filteredJobs.length === 0" class="empty-state">No roles match your search right now. Try a different keyword.</p>
    </section>

    <div v-if="showNameDialog" class="dialog-overlay">
      <div class="dialog-card">
        <h2>Candidate Details</h2>
        <p>Please provide the candidate's first and last name. The interview will begin as soon as you confirm.</p>
        <form class="dialog-form" @submit.prevent="handleConfirmName">
          <label>
            First Name
            <input v-model.trim="firstName" type="text" required placeholder="e.g., Alex" @invalid="(event) => handleInvalid(event, 'Please enter the first name.')" @input="handleInput" />
          </label>
          <label>
            Last Name
            <input v-model.trim="lastName" type="text" required placeholder="e.g., Johnson" @invalid="(event) => handleInvalid(event, 'Please enter the last name.')" @input="handleInput" />
          </label>
          <p v-if="nameError" class="error">{{ nameError }}</p>
          <div class="dialog-actions">
            <button type="button" class="ghost" @click="handleCancelName">Cancel</button>
            <button type="submit" class="primary">OK</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="recordsJob" class="dialog-overlay">
      <div class="records-card">
        <header class="records-header">
          <div>
            <h2>Interview Records</h2>
            <p>{{ recordsJob.title }} &bull; {{ recordsJob.companyName ?? 'Company' }}</p>
          </div>
          <button class="close" type="button" @click="closeRecords" aria-label="Close records">&times;</button>
        </header>

        <section v-if="recordsForSelectedJob.length > 0" class="records-body">
          <div class="records-scroll">
            <article v-for="record in recordsForSelectedJob" :key="record.id" class="record-item">
              <header class="record-meta">
                <div class="record-heading">
                  <h3>{{ record.candidateName.first }} {{ record.candidateName.last }}</h3>
                  <span>{{ formatTime(record.completedAt) }}</span>
                </div>
                <button
                  type="button"
                  class="collapse-toggle"
                  :aria-expanded="isRecordExpanded(record.id)"
                  @click="toggleRecord(record.id)"
                >
                  <span>{{ isRecordExpanded(record.id) ? 'Hide conversation' : 'Show conversation' }}</span>
                  <span class="chevron" :class="{ 'chevron-open': isRecordExpanded(record.id) }" aria-hidden="true"></span>
                </button>
              </header>
              <transition name="fold">
                <div v-if="isRecordExpanded(record.id)" class="conversation-panel">
                  <ul class="conversation">
                    <li v-for="(turn, index) in record.conversation" :key="index" :class="turn.speaker">
                      <div class="chat-meta">
                        <span class="chat-name">{{ getSpeakerName(record, turn.speaker) }}</span>
                      </div>
                      <div class="chat-bubble">
                        <p>{{ turn.message }}</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </transition>
            </article>
          </div>
        </section>
        <p v-else class="empty-state">No interviews recorded for this role yet.</p>
      </div>
    </div>

    <DigitalHumanModal
      v-if="activeJob"
      :job="activeJob"
      :candidate-name="currentCandidateName"
      @cancel="handleCancelInterview"
      @complete="handleCompleteInterview"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import jobData from './data/jobQuestions.json'
import DigitalHumanModal from './components/DigitalHumanModal.vue'
import type { ConversationTurn, InterviewAnswer, InterviewRecord, JobRole } from './types'

const jobs = jobData as JobRole[]
const pendingJob = ref<JobRole | null>(null)
const activeJob = ref<JobRole | null>(null)
const showNameDialog = ref(false)
const firstName = ref('')
const lastName = ref('')
const nameError = ref('')
const searchQuery = ref('')
const currentCandidateName = ref<{ first: string; last: string } | null>(null)
const recordsJob = ref<JobRole | null>(null)
const expandedRecordIds = ref<Set<string>>(new Set())

const STORAGE_KEY = 'digital-human:records-v2'
const interviewRecords = ref<InterviewRecord[]>(loadRecords())

const recordsByJob = computed(() => {
  const map: Record<string, InterviewRecord[]> = {}
  for (const record of interviewRecords.value) {
    if (!map[record.jobId]) {
      map[record.jobId] = []
    }
    map[record.jobId].push(record)
  }
  return map
})

const completedJobIds = computed(() => {
  const set = new Set<string>()
  for (const record of interviewRecords.value) {
    set.add(record.jobId)
  }
  return set
})

const filteredJobs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return jobs
  }
  return jobs.filter((job) => {
    const searchable = [
      job.title,
      job.summary,
      job.companyName,
      job.location,
      job.salaryRange,
      job.employmentType,
      ...(job.requirements ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchable.includes(query)
  })
})

const recordsForSelectedJob = computed(() => {
  if (!recordsJob.value) {
    return []
  }
  return recordsByJob.value[recordsJob.value.id] ?? []
})

watch(
  () => recordsJob.value?.id ?? null,
  (jobId) => {
    if (jobId) {
      initializeExpandedRecords(jobId)
    } else {
      expandedRecordIds.value = new Set()
    }
  }
)

watch(recordsForSelectedJob, (records) => {
  if (records.length === 0) {
    expandedRecordIds.value = new Set()
    return
  }
  const allowedIds = new Set(records.map((record) => record.id))
  const next = new Set<string>()
  for (const id of expandedRecordIds.value) {
    if (allowedIds.has(id)) {
      next.add(id)
    }
  }
  if (next.size === 0 && records[0]) {
    next.add(records[0].id)
  }
  expandedRecordIds.value = next
})

function handleStartInterview(job: JobRole) {
  if (isJobCompleted(job.id)) {
    return
  }
  pendingJob.value = job
  firstName.value = ''
  lastName.value = ''
  nameError.value = ''
  showNameDialog.value = true
}

function handleConfirmName() {
  if (!firstName.value.trim() || !lastName.value.trim()) {
    nameError.value = 'Please enter both the first and last name.'
    return
  }
  if (!pendingJob.value) {
    showNameDialog.value = false
    return
  }
  nameError.value = ''
  showNameDialog.value = false
  currentCandidateName.value = {
    first: firstName.value.trim(),
    last: lastName.value.trim(),
  }
  activeJob.value = pendingJob.value
  pendingJob.value = null
}

function handleCancelName() {
  pendingJob.value = null
  showNameDialog.value = false
}

function handleCancelInterview() {
  activeJob.value = null
  currentCandidateName.value = null
}

function handleCompleteInterview(payload: { conversation: ConversationTurn[]; answers: InterviewAnswer[]; completedAt: string }) {
  if (!activeJob.value || !currentCandidateName.value) {
    activeJob.value = null
    currentCandidateName.value = null
    return
  }

  const record: InterviewRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `record-${Date.now()}`,
    jobId: activeJob.value.id,
    jobTitle: activeJob.value.title,
    candidateName: { ...currentCandidateName.value },
    conversation: payload.conversation,
    completedAt: payload.completedAt,
  }

  interviewRecords.value = [record, ...interviewRecords.value]
  persistRecords()

  activeJob.value = null
  currentCandidateName.value = null
}

function getSpeakerName(record: InterviewRecord, speaker: ConversationTurn['speaker']) {
  if (speaker === 'interviewer') {
    return 'Interviewer'
  }
  return `${record.candidateName.first} ${record.candidateName.last}`.trim()
}

function openRecords(job: JobRole) {
  recordsJob.value = job
  initializeExpandedRecords(job.id)
}

function isJobCompleted(jobId: string) {
  return completedJobIds.value.has(jobId)
}

function closeRecords() {
  recordsJob.value = null
  expandedRecordIds.value = new Set()
}

function toggleRecord(recordId: string) {
  const next = new Set(expandedRecordIds.value)
  if (next.has(recordId)) {
    next.delete(recordId)
  } else {
    next.add(recordId)
  }
  expandedRecordIds.value = next
}

function isRecordExpanded(recordId: string) {
  return expandedRecordIds.value.has(recordId)
}

function initializeExpandedRecords(jobId: string) {
  const jobRecords = recordsByJob.value[jobId] ?? []
  const next = new Set<string>()
  if (jobRecords[0]) {
    next.add(jobRecords[0].id)
  }
  expandedRecordIds.value = next
}

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  input.setCustomValidity('')
}

function handleInvalid(event: Event, message: string) {
  const input = event.target as HTMLInputElement
  input.setCustomValidity(message)
}
function loadRecords(): InterviewRecord[] {
  if (typeof window === 'undefined') {
    return []
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as InterviewRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistRecords() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(interviewRecords.value))
}

function formatTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  })
}
</script>

<style scoped>
.app {
  min-height: 100vh;
  padding: 3rem 1.5rem 4rem;
  max-width: 1160px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.hero-banner {
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  background: radial-gradient(circle at 15% -10%, rgba(99, 102, 241, 0.35), transparent 55%),
    radial-gradient(circle at 80% 120%, rgba(56, 189, 248, 0.25), transparent 60%),
    linear-gradient(135deg, #111c44, #1e1b4b);
  padding: 3.25rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  color: #f8fafc;
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.35);
}

.hero-banner::before,
.hero-banner::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.hero-banner::before {
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.35), transparent 70%);
  top: -120px;
  right: -90px;
}

.hero-banner::after {
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(244, 244, 255, 0.15), transparent 65%);
  bottom: -140px;
  left: -70px;
}

.hero-chip {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.2);
  color: #e0f2fe;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-title {
  margin: 0;
  font-size: clamp(2.4rem, 4vw, 3.1rem);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.hero-subtitle {
  margin: 0;
  color: rgba(241, 245, 249, 0.86);
  line-height: 1.7;
  max-width: 36rem;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.hero-meta span {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  color: #e2e8f0;
  font-size: 0.85rem;
  font-weight: 500;
}

.search-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.6);
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #5162ff;
  box-shadow: 0 0 0 2px rgba(81, 98, 255, 0.2);
}

.search-count {
  font-size: 0.9rem;
  color: #4b5563;
  white-space: nowrap;
}

.jobs {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.job-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.job-header h2 {
  margin: 0;
  font-size: 1.35rem;
  color: #1f2937;
}

.job-company {
  margin: 0.25rem 0 0;
  color: #4b5563;
  font-size: 0.95rem;
}

.job-tag {
  background: rgba(99, 102, 241, 0.15);
  color: #4338ca;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-weight: 600;
}

.job-summary {
  margin: 0;
  color: #374151;
  line-height: 1.6;
}

.job-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.95rem;
  color: #1f2937;
}

.job-salary {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-weight: 600;
}

.requirements {
  margin: 0;
  padding-left: 1.1rem;
  color: #4b5563;
  font-size: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.primary,
.secondary,
.ghost {
  padding: 0.6rem 1.6rem;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.primary {
  background: linear-gradient(135deg, #6a83ff, #5063ff);
  color: #fff;
}

.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(80, 99, 255, 0.25);
}

.primary:disabled {
  cursor: not-allowed;
  background: rgba(148, 163, 184, 0.45);
  color: rgba(255, 255, 255, 0.75);
  box-shadow: none;
  transform: none;
}

.secondary {
  background: rgba(99, 102, 241, 0.12);
  color: #4338ca;
}

.secondary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(67, 56, 202, 0.15);
}

.secondary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 12, 32, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 1200;
}

.dialog-card {
  width: min(720px, 100%);
  background: #ffffff;
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 32px 64px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-height: min(90vh, 720px);
  overflow-y: auto;
}

.records-card {
  width: min(720px, 100%);
  background: #ffffff;
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 32px 64px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-height: min(90vh, 720px);
  overflow: hidden;
}

.records-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.records-scroll {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
  padding-right: 0.5rem;
  margin-right: -0.5rem;
}

.records-scroll::-webkit-scrollbar {
  width: 8px;
}

.records-scroll::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.18);
  border-radius: 999px;
}

.records-scroll::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.45);
  border-radius: 999px;
}

@supports (scrollbar-width: thin) {
  .records-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(99, 102, 241, 0.45) rgba(148, 163, 184, 0.18);
  }
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: #374151;
}

.dialog-form input {
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.6);
  border-radius: 10px;
  font-size: 1rem;
}

.error {
  margin: 0;
  color: #dc2626;
  font-size: 0.85rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.ghost {
  background: transparent;
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #5162ff;
}

.ghost:hover {
  border-color: rgba(99, 102, 241, 0.6);
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.records-header h2 {
  margin: 0;
  font-size: 1.4rem;
  color: #1f2937;
}

.records-header p {
  margin: 0.35rem 0 0;
  color: #4b5563;
  font-size: 0.95rem;
}

.close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.55);
}

.record-item {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 18px;
  padding: 1.25rem;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.record-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.record-heading {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.collapse-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #4338ca;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.collapse-toggle:hover {
  background: rgba(79, 70, 229, 0.12);
  border-color: rgba(79, 70, 229, 0.45);
  color: #312e81;
}

.chevron {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
  margin-left: 0.15rem;
}

.chevron-open {
  transform: rotate(-135deg);
}

.conversation-panel {
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  margin-top: 0.75rem;
  padding-top: 0.75rem;
}

.conversation {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fold-enter-from,
.fold-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-6px);
}

.fold-enter-active,
.fold-leave-active {
  transition: max-height 0.24s ease, opacity 0.24s ease, transform 0.24s ease;
}

.fold-enter-to,
.fold-leave-from {
  max-height: 600px;
  opacity: 1;
  transform: translateY(0);
}

.conversation li {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-width: 78%;
}

.conversation li.interviewer {
  align-self: flex-start;
  align-items: flex-start;
}

.conversation li.candidate {
  align-self: flex-end;
  align-items: flex-end;
}

.chat-meta {
  display: flex;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #64748b;
}

.conversation li.candidate .chat-meta {
  justify-content: flex-end;
  color: #0f766e;
}

.chat-name {
  font-weight: 600;
}

.chat-bubble {
  padding: 0.8rem 1rem;
  border-radius: 16px;
  line-height: 1.5;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
  background: rgba(99, 102, 241, 0.12);
  color: #1f2937;
}

.conversation li.interviewer .chat-bubble {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(79, 70, 229, 0.22));
  color: #1e1b4b;
  border-bottom-left-radius: 4px;
}

.conversation li.candidate .chat-bubble {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(20, 184, 166, 0.28));
  color: #064e3b;
  border-bottom-right-radius: 4px;
}

.chat-bubble p {
  margin: 0;
}

.empty-state {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
  text-align: center;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-12px);
  }
}

@media (max-width: 720px) {
  .search-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .job-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .conversation li {
    max-width: 88%;
  }

  .dialog-card,
  .records-card {
    padding: 1.5rem;
  }
}
</style>
