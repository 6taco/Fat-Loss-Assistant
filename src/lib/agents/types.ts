import type {
  DailyReport,
  DayPlan,
  MealLog,
  UserProfile,
  WeightEntry,
  WeeklyReport,
  WeightPredictionResult,
} from '@/lib/mock-data';
import type { ToolCallDraft, ToolName } from '@/lib/mcp/types';

export type AgentName = 'nutrition' | 'training' | 'recovery' | 'strategy' | 'coach';
export type AgentConfidence = 'high' | 'medium' | 'low';
export type AgentRunType = 'daily' | 'weekly' | 'chat' | 'manual';
export type AgentIntent = 'nutrition' | 'training' | 'recovery' | 'plateau' | 'strategy' | 'general';

export interface AgentContext {
  user: UserProfile;
  date: string;
  plans: DayPlan[];
  meals: MealLog[];
  weights: WeightEntry[];
  reports: {
    daily?: DailyReport;
    weekly?: WeeklyReport;
  };
  predictions?: WeightPredictionResult;
  memories: AgentMemoryDto[];
  coachMemories: unknown[];
  ragEvidence: RagEvidence[];
}

export interface RagEvidence {
  id: string;
  title: string;
  text: string;
  authority: string;
  year?: number;
}

export interface AgentMessageEnvelope {
  runId: string;
  userId: string;
  date: string;
  source: AgentRunType | 'cron';
  from: AgentName | 'orchestrator';
  to: AgentName | 'broadcast';
  messageType:
    | 'context'
    | 'analysis_request'
    | 'analysis_result'
    | 'strategy_request'
    | 'strategy_result'
    | 'coach_response_request'
    | 'coach_response_result'
    | 'error';
  payload: unknown;
  confidence: AgentConfidence;
  evidenceRefs: string[];
  createdAt: string;
}

export interface RecommendedAction {
  actionType: ToolName | 'none';
  priority: 1 | 2 | 3;
  arguments?: Record<string, unknown>;
  reason: string;
}

export interface AgentFindingDto {
  id: string;
  agent: AgentName;
  type: 'nutrition' | 'training' | 'recovery' | 'plateau' | 'adherence' | 'strategy' | 'motivation';
  severity: 'info' | 'warning' | 'action';
  title: string;
  summary: string;
  evidence: unknown;
  confidence: AgentConfidence;
  recommendedActions: RecommendedAction[];
}

export interface AgentMemoryDto {
  id?: string;
  userId?: string;
  agent: AgentName;
  type:
    | 'preference'
    | 'effective_strategy'
    | 'risk_pattern'
    | 'rejected_advice'
    | 'milestone'
    | 'nutrition_pattern'
    | 'training_pattern'
    | 'recovery_pattern';
  title: string;
  content: unknown;
  confidence: number;
  source: string;
}

export interface AgentResult {
  agent: AgentName;
  score?: number;
  findings: AgentFindingDto[];
  proposalDrafts: ToolCallDraft[];
  memoryWrites: AgentMemoryDto[];
  confidence: AgentConfidence;
}

export interface StrategyResult extends AgentResult {
  strategySummary: string;
  plateauAssessment: string;
  priorities: string[];
}

export interface CoachAgentResult extends AgentResult {
  message: string;
  cards: { type: 'suggestion'; title: string; items: { label: string; value: string }[] }[];
  insight: {
    type: AgentFindingDto['type'];
    severity: AgentFindingDto['severity'];
    title: string;
    summary: string;
    evidence: unknown;
  };
}

export interface RunAgentWorkflowInput {
  userId: string;
  runType: AgentRunType;
  date?: string;
  intent?: AgentIntent;
  message?: string;
  force?: boolean;
}

export interface RunAgentWorkflowResult {
  runId: string;
  status: 'completed' | 'failed';
  findings: AgentFindingDto[];
  proposals: unknown[];
  coachMessage?: CoachAgentResult;
}
