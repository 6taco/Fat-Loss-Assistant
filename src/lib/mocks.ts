import type {
  ChatMessage,
  DailyReport,
  MealLog,
  UserProfile,
  WeightEntry,
  WeightPredictionResult,
  WeeklyReport,
} from '@/lib/types';
import { defaultTrainingSchedule, generateCarbCyclePlan } from '@/lib/domain';

// Demo/fallback fixtures. Only import these from code paths that genuinely
// needs placeholder data — production logic lives in domain.ts.
export const mockUser: UserProfile = {
  id: 'user-001',
  name: 'Alex',
  gender: 'male',
  age: 25,
  height: 175,
  weight: 72,
  bodyFat: 20,
  trainingFrequency: 2,
  trainingIntensity: 'high',
  startDate: '2025-01-01',
  initialWeightDate: '2025-01-01',
  goalWeight: 67,
  somatotype: 'mesomorph',
  trainingSchedule: defaultTrainingSchedule,
};

export const mockPlan = generateCarbCyclePlan(
  new Date().toISOString().slice(0, 10),
  mockUser.weight,
  mockUser.somatotype,
  mockUser.trainingSchedule,
);

export const mockWeightLog: WeightEntry[] = [
  { date: '2025-01-01', weight: 72.5 },
  { date: '2025-01-03', weight: 72.3 },
  { date: '2025-01-05', weight: 72.0 },
  { date: '2025-01-07', weight: 71.8 },
  { date: '2025-01-09', weight: 72.1 },
  { date: '2025-01-11', weight: 71.6 },
  { date: '2025-01-13', weight: 71.3 },
  { date: '2025-01-14', weight: 71.1 },
];

export const mockMealLogs: MealLog[] = [];
export const mockDailyReports: DailyReport[] = [];
export const mockWeeklyReports: WeeklyReport[] = [];
export const mockWeightPredictions: WeightPredictionResult[] = [];

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-001',
    role: 'ai',
    content: '你好，我是 Coach Zero。完成基础信息后，我会根据你的体重、胚型和训练安排生成 232 碳循环计划。',
    timestamp: '2025-01-14T09:00:00',
  },
  {
    id: 'msg-002',
    role: 'ai',
    content: '高碳日会优先匹配背部和腿部训练，低碳日会优先匹配休息日，蛋白质每天保持一致。',
    timestamp: '2025-01-14T09:00:05',
    cards: [
      {
        type: 'suggestion',
        title: '碳循环生成规则',
        items: [
          { label: '周结构', value: '2 高碳 / 3 中碳 / 2 低碳' },
          { label: '蛋白质', value: '每天一致' },
          { label: '训练匹配', value: '背腿高碳，休息低碳' },
        ],
      },
    ],
  },
];
