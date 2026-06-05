export interface UserProfile {
  name: string;
  email: string;
  targetRole: string;
  targetLocation: string;
  experienceLevel: string;
  preferredSalary: string;
  cvText: string;
  cvChunks: CVChunk[];
  cvFileName: string;
  cvScore: CVScore | null;
}

export interface CVChunk {
  section: string;
  content: string;
  embedding?: number[];
}

export interface CVScore {
  contentClarity: number;
  keywordOptimization: number;
  quantifiedImpact: number;
  formatting: number;
  completeness: number;
  total: number;
  predictedRoles?: {
    role: string;
    matchPercentage: number;
    matchedSkills: string[];
    missingSkills: string[];
  }[];
}

export interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  deadline: string;
  source: string;
  url: string;
  description: string;
  requirements: string[];
  fitScore: number;
  fitBreakdown: {
    skills: number;
    experience: number;
    education: number;
    location: number;
  };
  matchReasons: string[];
  gaps: string[];
  tags: string[];
  postedDate: string;
}

export interface TrackedApplication {
  id: string;
  company: string;
  role: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';
  appliedDate: string;
  lastUpdated: string;
  notes: string;
  source: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface RoadmapTopic {
  id: string;
  text: string;
  hours: string;
  resource: string;
  completed: boolean;
}

export interface RoadmapWeek {
  title: string;
  topics: RoadmapTopic[];
}

export interface RoadmapMonth {
  title: string;
  milestone: string;
  weeks: RoadmapWeek[];
}

export type ActiveView = 'dashboard' | 'chat' | 'jobs' | 'profile' | 'tracker' | 'roadmap' | 'interview' | 'salary';

export interface Goal {
  id: string;
  text: string;
  deadline: string;
  done: boolean;
}

export interface SavedSearch {
  id: string;
  query: string;
  createdAt: string;
  lastChecked: string;
  resultCount: number;
}

