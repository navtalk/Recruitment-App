export interface InterviewQuestion {
  id: string
  text: string
}

export interface JobRole {
  id: string
  title: string
  summary: string
  questions: InterviewQuestion[]
  prompt?: string
  characterName?: string
  voice?: string
  companyName?: string
  location?: string
  salaryRange?: string
  employmentType?: string
  requirements?: string[]
  generatedQuestionCount?: number
}

export interface ConversationTurn {
  speaker: 'interviewer' | 'candidate'
  message: string
}

export interface InterviewAnswer {
  questionId: string
  answer: string
  questionText?: string
}

export interface InterviewRecord {
  id: string
  jobId: string
  jobTitle: string
  candidateName: {
    first: string
    last: string
  }
  conversation: ConversationTurn[]
  completedAt: string
}
