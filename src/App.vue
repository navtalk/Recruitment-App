<template>
  <div class="app">
    <header class="site-header">
      <div class="brand">
        <span class="brand-logo">NavTalk</span>
        <span class="brand-tagline">Digital Hiring Studio</span>
      </div>
      <!-- <div class="header-actions">
        <button type="button" class="ghost-link">Post a job</button>
      </div> -->
    </header>

    <main class="layout">
      <div class="search-widget">
        <h2 class="search-heading">Search jobs</h2>
        <div class="search-card">
          <div class="search-pill">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Job title, keywords, or company"
              aria-label="Search by job title, keywords, or company"
            />
          </div>
          <div class="search-pill narrow">
            <span class="location-icon" aria-hidden="true">📍</span>
            <input
              v-model="locationQuery"
              type="search"
              placeholder="Location"
              aria-label="Search by location"
            />
          </div>
          <button type="button" class="search-button">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <span>Search Jobs</span>
          </button>
        </div>
      </div>

      <div class="content-grid">
        <aside class="sidebar">
          <section class="list-section">
            <div class="section-header">
              <h3>Featured jobs</h3>
              <span>{{ featuredJobs.length }}</span>
            </div>
            <ul class="job-list">
            <li
              v-for="job in featuredJobs"
              :key="job.id"
              :class="['job-row', { active: selectedJob && selectedJob.id === job.id }]"
              @click="handleSelectJob(job)"
            >
              <div class="job-avatar">{{ getJobInitials(job.title) }}</div>
              <div class="job-row-content">
                <h4>{{ job.title }}</h4>
                <p>{{ job.companyName }}</p>
                <span>{{ job.location }}</span>
              </div>
              <span class="job-row-meta">Updated recently</span>
            </li>
          </ul>
          <p v-if="featuredJobs.length === 0" class="list-empty">No featured jobs match your search.</p>
        </section>

        <section class="list-section">
          <div class="section-header">
            <h3>Latest jobs</h3>
            <span>{{ latestJobs.length }}</span>
          </div>
          <ul class="job-list">
            <li
              v-for="job in latestJobs"
              :key="job.id"
              :class="['job-row', { active: selectedJob && selectedJob.id === job.id }]"
              @click="handleSelectJob(job)"
            >
              <div class="job-avatar job-avatar-alt">{{ getJobInitials(job.title) }}</div>
              <div class="job-row-content">
                <h4>{{ job.title }}</h4>
                <p>{{ job.companyName }}</p>
                <span>{{ job.location }}</span>
              </div>
              <span class="job-row-meta">New</span>
            </li>
          </ul>
          <p v-if="latestJobs.length === 0" class="list-empty">No more job posts.</p>
          </section>
        </aside>

        <section class="detail-column">
          <div v-if="selectedJob" class="detail-card">
            <header class="detail-header">
              <div class="detail-title">
                <span class="status-pill">Application submitted</span>
                <h1>{{ selectedJob.title }}</h1>
                <p>
                  <span v-if="selectedJob.companyName">{{ selectedJob.companyName }}</span>
                  <span v-if="selectedJob.companyName && selectedJob.location"> • </span>
                  <span v-if="selectedJob.location">{{ selectedJob.location }}</span>
                </p>
              </div>
              <div class="detail-actions">
                <button
                  class="secondary small"
                  type="button"
                  @click="openRecords(selectedJob)"
                  :disabled="!recordsByJob[selectedJob.id] || recordsByJob[selectedJob.id].length === 0"
                >
                  View Records
                </button>
              </div>
            </header>

            <div class="detail-alert">
              <div class="alert-figure">
                <img
                  :src="interviewerAvatar"
                  alt="Digital interviewer profile"
                  loading="lazy"
                />
              </div>
              <div class="alert-content">
                <h4>You're successfully applied!</h4>
                <p>
                  Thanks for applying to move forward, please complete a quick online pre-interview — it only takes a few minutes.
                </p>
                <div class="detail-buttons">
                  <button
                    class="primary"
                    type="button"
                    @click="selectedJob && handleStartInterview(selectedJob)"
                    :disabled="!selectedJob || isJobCompleted(selectedJob.id)"
                  >
                    {{ selectedJob && isJobCompleted(selectedJob.id) ? 'Interview Completed' : 'Start Interview' }}
                  </button>
                  <!-- <button class="ghost" type="button">Save for later</button> -->
                </div>
              </div>
            </div>

            <div class="detail-meta" v-if="selectedJob.salaryRange || selectedJob.employmentType">
              <div class="meta-block">
                <span class="meta-label">Base pay range</span>
                <span class="meta-value">{{ selectedJob.salaryRange ?? 'Not provided' }}</span>
              </div>
              <div class="meta-block" v-if="selectedJob.employmentType">
                <span class="meta-label">Employment type</span>
                <span class="meta-value">{{ selectedJob.employmentType }}</span>
              </div>
            </div>

            <div class="detail-body">
              <section class="detail-section">
                <h3>Role overview</h3>
                <p>{{ selectedJob.summary }}</p>
              </section>

              <section class="detail-section" v-if="selectedJob.requirements?.length">
                <h3>Key responsibilities</h3>
                <ul>
                  <li v-for="requirement in selectedJob.requirements" :key="requirement">{{ requirement }}</li>
                </ul>
              </section>
            </div>
          </div>
          <div v-else class="detail-empty">
            <h2>No roles found</h2>
            <p>Try adjusting your filters to discover more opportunities.</p>
          </div>
        </section>
      </div>
    </main>

    <footer class="site-footer">
      <div class="footer-brand">
        <span class="brand-logo">NavTalk</span>
        <p>Connect talented professionals with amazing companies. Your next career opportunity is just one click away.</p>
      </div>
      <div class="footer-column">
        <h4>Resources</h4>
        <ul>
          <li><a href="https://navtalk.ai/">NavTalk</a></li>
          <li><a href="https://navbot.com/en/">NavBot</a></li>
          <li><a href="https://navtalk.ai/use-cases/">Case studies</a></li>
          <li><a href="https://frankfu.blog/">Blog</a></li>
        </ul>
      </div>
      <div class="footer-column">
        <h4>Social</h4>
        <ul>
          <li><a href="https://www.youtube.com/@frankfu007">YouTube</a></li>
          <li><a href="#">Discord</a></li>
          <li><a href="https://www.linkedin.com/in/navbot-frank/">LinkedIn</a></li>
          <li><a href="https://x.com/fuwei007cn/">X</a></li>
        </ul>
      </div>
      <div class="footer-column">
        <h4>Contact</h4>
        <ul>
          <li><a href="tel:+12144071346">+1 (214) 407-1346</a></li>
          <li><a href="mailto:sales@navtalk.ai">sales@navtalk.ai</a></li>
        </ul>
      </div>
    </footer>

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
import interviewerAvatar from './assets/interviewer-avatar.png'

const jobs = jobData as JobRole[]
const activeJob = ref<JobRole | null>(null)
const searchQuery = ref('')
const locationQuery = ref('')
const currentCandidateName = ref<{ first: string; last: string } | null>(null)
const recordsJob = ref<JobRole | null>(null)
const expandedRecordIds = ref<Set<string>>(new Set())
const selectedJob = ref<JobRole | null>(jobs[0] ?? null)

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
  const location = locationQuery.value.trim().toLowerCase()

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

    const matchesQuery = query ? searchable.includes(query) : true
    const matchesLocation = location ? (job.location ?? '').toLowerCase().includes(location) : true
    return matchesQuery && matchesLocation
  })
})

const featuredJobs = computed(() => filteredJobs.value.slice(0, 3))
const latestJobs = computed(() => filteredJobs.value.slice(3))

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

watch(filteredJobs, (list) => {
  if (!list.length) {
    selectedJob.value = null
    return
  }
  if (!selectedJob.value || !list.some((job) => job.id === selectedJob.value?.id)) {
    selectedJob.value = list[0]
  }
})

function handleStartInterview(job: JobRole) {
  if (isJobCompleted(job.id)) {
    return
  }
  currentCandidateName.value = generateRandomCandidateName()
  activeJob.value = job
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

function handleSelectJob(job: JobRole) {
  selectedJob.value = job
}

function getJobInitials(title: string) {
  const parts = title.split(' ').filter(Boolean)
  if (!parts.length) {
    return 'JT'
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const firstNames = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Jamie', 'Riley', 'Avery', 'Harper', 'Logan']
const lastNames = ['Chen', 'Wang', 'Zhang', 'Liu', 'Smith', 'Johnson', 'Brown', 'Davis', 'Garcia', 'Lee']

function generateRandomCandidateName(): { first: string; last: string } {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)]
  const last = lastNames[Math.floor(Math.random() * lastNames.length)]
  return { first, last }
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
  display: flex;
  flex-direction: column;
  background: #f5f6fb;
  color: #0f172a;
}

.site-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.75rem clamp(1.5rem, 6vw, 3rem) 1.5rem;
  background: #ffffff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.brand-logo {
  font-size: 1.35rem;
  font-weight: 700;
  color: #4338ca;
  letter-spacing: -0.01em;
}

.brand-tagline {
  font-size: 0.9rem;
  color: #64748b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.ghost-link {
  border: 1px solid rgba(99, 102, 241, 0.3);
  background: transparent;
  color: #4338ca;
  padding: 0.55rem 1.25rem;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.ghost-link:hover {
  border-color: rgba(99, 102, 241, 0.6);
  color: #312e81;
  transform: translateY(-1px);
}

.layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding: 2.5rem clamp(1.5rem, 6vw, 3rem) 3.5rem;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  min-height: 0;
}

.content-grid {
  flex: 1;
  display: flex;
  gap: 2.5rem;
  min-height: 0;
}

.sidebar {
  width: min(520px, 40vw);
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.search-widget {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.search-heading {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 600;
  color: #111827;
  padding-left: 0.35rem;
}

.search-card {
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 48px;
  padding: 0.5rem 0.6rem;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
  display: flex;
  gap: 0.6rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.search-pill {
  flex: 1;
  background: #f3f4f8;
  border-radius: 40px;
  padding: 0.55rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.search-pill:focus-within {
  border-color: rgba(79, 70, 229, 0.35);
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
  background: #ffffff;
}

.search-icon,
.location-icon {
  font-size: 1rem;
  color: #94a3b8;
}

.search-pill input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: #0f172a;
}

.search-pill input::placeholder {
  color: #9aa3b9;
}

.search-pill input:focus {
  outline: none;
}

.search-pill.narrow {
  flex: 0.25;
  min-width: 120px;
}

.search-card .search-button {
  padding: 0.65rem 1.6rem;
  background: #1e1b4b;
  color: #ffffff;
  border-radius: 40px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.search-card .search-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(30, 27, 75, 0.2);
}

.search-card button {
  padding: 0.65rem 1.35rem;
  background: #1e1b4b;
  color: #ffffff;
  border-radius: 40px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.search-card button:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(30, 27, 75, 0.2);
}

.list-section {
  background: #ffffff;
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.list-section:last-of-type {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #0f172a;
}

.section-header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.section-header span {
  font-size: 0.85rem;
  color: #64748b;
}

.job-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: calc(100% - 1rem);
  overflow-y: auto;
}

.job-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 16px;
  background: rgba(241, 245, 249, 0.6);
  border: 1px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.job-row:hover {
  border-color: rgba(79, 70, 229, 0.3);
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.12);
  transform: translateY(-1px);
}

.job-row.active {
  border-color: rgba(79, 70, 229, 0.5);
  background: rgba(243, 244, 255, 0.9);
  box-shadow: 0 12px 28px rgba(79, 70, 229, 0.22);
}

.job-avatar {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: rgba(79, 70, 229, 0.12);
  color: #4338ca;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.job-avatar-alt {
  background: rgba(16, 185, 129, 0.15);
  color: #0f766e;
}

.job-row-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.job-row-content h4 {
  margin: 0;
  font-size: 0.98rem;
  color: #0f172a;
}

.job-row-content p {
  margin: 0;
  font-size: 0.85rem;
  color: #475569;
}

.job-row-content span {
  font-size: 0.8rem;
  color: #94a3b8;
}

.job-row-meta {
  font-size: 0.75rem;
  color: #6366f1;
  font-weight: 600;
  text-transform: uppercase;
}

.list-empty {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

.detail-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.detail-card {
  background: #ffffff;
  border-radius: 32px;
  padding: 2rem clamp(1.5rem, 4vw, 2.6rem);
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.1);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  height: 100%;
  min-height: calc(100vh - 220px);
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  align-items: flex-start;
}

.detail-title h1 {
  margin: 0.35rem 0 0.25rem;
  font-size: clamp(1.5rem, 3vw, 2rem);
  color: #0f172a;
}

.detail-title p {
  margin: 0;
  color: #475569;
  font-size: 0.95rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.1);
  color: #0f766e;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.detail-actions {
  display: flex;
  gap: 0.75rem;
}

.secondary.small {
  padding: 0.45rem 1.05rem;
  font-size: 0.85rem;
}

.detail-alert {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.22);
  border-radius: 20px;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: minmax(112px, 148px) 1fr;
  align-items: stretch;
  gap: 1.5rem;
  color: #1e1b4b;
}

.alert-figure {
  height: 100%;
  width: clamp(112px, 12vw, 148px);
  aspect-ratio: 3 / 4;
  align-self: stretch;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 18px 36px rgba(30, 64, 175, 0.22);
  border: 1px solid rgba(99, 102, 241, 0.2);
  display: flex;
}

.alert-figure img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.alert-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: center;
}

.detail-alert h4 {
  margin: 0;
  font-size: 1.05rem;
}

.detail-alert p {
  margin: 0;
  line-height: 1.6;
  color: #312e81;
}

.detail-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.primary {
  padding: 0.75rem 1.8rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #6366f1, #4338ca);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 32px rgba(99, 102, 241, 0.24);
}

.primary:disabled {
  cursor: not-allowed;
  background: rgba(148, 163, 184, 0.4);
  box-shadow: none;
}

.secondary {
  padding: 0.7rem 1.6rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: rgba(248, 250, 252, 0.8);
  color: #1f2937;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.secondary:hover {
  transform: translateY(-1px);
  border-color: rgba(79, 70, 229, 0.45);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
}

.secondary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
  transform: none;
}

.ghost {
  padding: 0.7rem 1.6rem;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.3);
  background: transparent;
  color: #4338ca;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.ghost:hover {
  border-color: rgba(99, 102, 241, 0.6);
  color: #312e81;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.meta-block {
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.meta-value {
  font-size: 1.05rem;
  font-weight: 600;
  color: #0f172a;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  line-height: 1.7;
}

.detail-section h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: #0f172a;
}

.detail-section p {
  margin: 0;
  color: #475569;
}

.detail-section ul {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: #334155;
}

.detail-empty {
  flex: 1;
  background: rgba(148, 163, 184, 0.12);
  border: 1px dashed rgba(148, 163, 184, 0.4);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #475569;
}

.detail-empty h2 {
  margin: 0;
  font-weight: 600;
}

.site-footer {
  margin-top: auto;
  padding: 2.5rem clamp(1.5rem, 6vw, 3rem) 2.75rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 2rem;
  background: #0f172a;
  color: #e2e8f0;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.footer-brand .brand-logo {
  color: #ffffff;
  font-size: 1.3rem;
}

.site-footer h4 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  color: #f8fafc;
}

.site-footer ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.site-footer a {
  color: #cbd5f5;
  font-size: 0.9rem;
  text-decoration: none;
}

.site-footer a:hover {
  color: #f8fafc;
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

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.records-header h2 {
  margin: 0;
  font-size: 1.4rem;
  color: #111827;
}

.records-header p {
  margin: 0.35rem 0 0;
  color: #475569;
  font-size: 0.95rem;
}

.close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.5);
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

.record-item {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 18px;
  padding: 1.25rem;
  background: #f8fafc;
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

@media (max-width: 1200px) {
  .content-grid {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    max-height: none;
  }

  .list-section {
    flex: 1 1 min(320px, 100%);
  }

  .detail-column {
    width: 100%;
  }
}

@media (max-width: 900px) {
  .layout {
    padding: 2rem 1.5rem 3rem;
    gap: 1.75rem;
  }

  .sidebar {
    flex-direction: column;
  }

  .detail-card {
    padding: 1.75rem;
  }

  .detail-alert {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .alert-content {
    align-items: center;
  }

  .alert-figure {
    width: min(180px, 60vw);
  }

  .detail-buttons {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 720px) {
  .layout {
    padding: 1.75rem 1rem 2.5rem;
    gap: 1.5rem;
  }

  .search-widget {
    gap: 0.5rem;
  }

  .search-heading {
    font-size: 1rem;
  }

  .search-card {
    flex-direction: column;
    align-items: stretch;
    padding: 1rem;
    gap: 0.75rem;
    border-radius: 28px;
  }

  .search-pill,
  .search-pill.narrow {
    flex: none;
    width: 100%;
    min-width: 0;
    padding: 0.75rem 1rem;
  }

  .search-card button {
    width: 100%;
    justify-content: center;
  }

  .content-grid {
    gap: 1.5rem;
  }

  .sidebar {
    gap: 1.25rem;
  }

  .list-section {
    padding: 1.25rem;
  }

  .job-list {
    max-height: none;
    overflow: visible;
  }

  .job-row {
    align-items: flex-start;
    padding: 0.85rem 0.9rem;
    gap: 0.75rem;
  }

  .job-row-meta {
    font-size: 0.75rem;
  }

  .detail-card {
    padding: 1.5rem;
    gap: 1.5rem;
    min-height: 0;
    height: auto;
    overflow: visible;
  }

  .detail-title h1 {
    font-size: clamp(1.35rem, 6vw, 1.6rem);
  }

  .detail-body {
    gap: 1.5rem;
  }

  .detail-alert {
    padding: 1.25rem;
    gap: 1.25rem;
  }

  .detail-buttons,
  .detail-buttons > * {
    width: 100%;
  }

  .dialog-overlay {
    padding: 1.5rem clamp(1rem, 5vw, 1.75rem);
  }

  .records-card {
    padding: 1.5rem;
    border-radius: 20px;
    max-height: calc(100vh - 3rem);
  }

  .records-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .records-scroll {
    max-height: 50vh;
  }

  .record-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .collapse-toggle {
    width: 100%;
    justify-content: space-between;
  }

  .site-footer {
    padding: 2rem 1.5rem 2.25rem;
  }
}

@media (max-width: 640px) {
  .site-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.5rem 1rem 1.25rem;
  }

  .brand {
    width: 100%;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .ghost-link {
    width: 100%;
    justify-content: center;
  }

  .detail-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1.25rem;
  }

  .detail-title h1 {
    font-size: clamp(1.25rem, 7vw, 1.5rem);
  }

  .detail-title p {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .detail-alert {
    grid-template-columns: 1fr;
    justify-items: center;
    align-items: center;
    padding: 1.15rem;
  }

  .alert-content {
    align-items: center;
  }

  .alert-figure {
    width: min(160px, 70vw);
  }

  .detail-meta {
    flex-direction: column;
    gap: 0.75rem;
  }

  .conversation li {
    max-width: 100%;
  }

  .records-card {
    width: 100%;
  }

  .records-scroll {
    max-height: 55vh;
  }

  .site-footer {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .site-header {
    padding: 1.3rem 0.9rem 1.1rem;
  }

  .layout {
    padding: 1.25rem 0.85rem 2rem;
    gap: 1.35rem;
  }

  .search-card {
    padding: 0.9rem 0.85rem;
    border-radius: 24px;
  }

  .search-pill,
  .search-pill.narrow {
    padding: 0.65rem 0.85rem;
  }

  .search-pill input {
    font-size: 0.9rem;
  }

  .search-card button {
    padding: 0.65rem 1rem;
    font-size: 0.95rem;
  }

  .list-section {
    padding: 1.1rem;
  }

  .job-row {
    padding: 0.75rem 0.8rem;
  }

  .job-avatar {
    width: 38px;
    height: 38px;
    font-size: 0.95rem;
  }

  .status-pill {
    padding: 0.3rem 0.6rem;
  }

  .detail-card {
    padding: 1.35rem;
    border-radius: 24px;
  }

  .detail-title h1 {
    font-size: clamp(1.2rem, 7.5vw, 1.4rem);
  }

  .detail-alert {
    padding: 1rem;
  }

  .records-card {
    padding: 1.25rem;
    max-height: calc(100vh - 2rem);
  }

  .records-scroll {
    max-height: 60vh;
  }

  .dialog-overlay {
    padding: 1rem;
  }

  .site-footer {
    padding: 1.6rem 1rem 1.85rem;
  }
}
</style>




