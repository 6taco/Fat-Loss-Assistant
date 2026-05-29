'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import {
  Brain,
  CheckCircle2,
  FileText,
  Inbox,
  MessageSquare,
  Scale,
  Settings,
  Share2,
  Sparkles,
  TrendingDown,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import GlassCard from '@/components/ui/GlassCard';
import RingChart from '@/components/ui/RingChart';
import { showAppToast } from '@/components/ui/ToastHost';
import { track } from '@/lib/analytics/client';
import { clearLocalAppData, downloadLocalAppData } from '@/lib/app-data';
import { clearActiveAccount, getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getItem, KEYS } from '@/lib/storage';
import { useMealStore } from '@/stores/useMealStore';
import { usePlanStore } from '@/stores/usePlanStore';
import { useReportInboxStore } from '@/stores/useReportInboxStore';
import { useStrategyStore } from '@/stores/useStrategyStore';
import { useUserStore } from '@/stores/useUserStore';
import { useWeightStore } from '@/stores/useWeightStore';
import {
  carbColors,
  getFatBurnIndex,
  getTodayPlan,
  mockUser,
  type CarbType,
  type DailyReport,
  type UserProfile,
  type WeightEntry,
  type WeeklyReport,
} from '@/lib/mock-data';

const todayIso = new Date().toISOString().slice(0, 10);

const carbLabel: Record<CarbType, string> = {
  high: '高碳日',
  mid: '中碳日',
  low: '低碳日',
};

const carbTip: Record<CarbType, string> = {
  high: '今天适合安排背部或腿部训练。主食优先选择米饭、土豆、燕麦等稳定碳水来源。',
  mid: '今天重点是稳定执行。保证蛋白质摄入，训练和日常步数都不要掉线。',
  low: '今天更需要控制饥饿感。优先保证蛋白质、蔬菜、饮水和电解质。',
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loadUser } = useUserStore();
  const { plans, loadPlans, toggleComplete } = usePlanStore();
  const { entries: weightEntries, loadEntries, addEntry } = useWeightStore();
  const { loadMeals, getDailySummary } = useMealStore();
  const { dailyReports, weeklyReports, isLoading: reportsLoading, loadReports, generateWeeklyReport, markRead } = useReportInboxStore();
  const { currentStrategy, recommendation, proposals: strategyProposals, executionRate, loadCurrent: loadStrategy, recheck: recheckStrategy } = useStrategyStore();
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [selectedReport, setSelectedReport] = useState<{ type: 'daily'; report: DailyReport } | { type: 'weekly'; report: WeeklyReport } | null>(null);
  const [weightValue, setWeightValue] = useState('');

  useEffect(() => {
    const activeAccount = getActiveAccount();
    if (!activeAccount) {
      router.replace('/accounts');
      return;
    }
    if (!getItem(getScopedKey(KEYS.USER), null)) {
      router.replace('/onboarding');
      return;
    }
    loadUser();
    loadPlans();
    loadEntries();
    loadMeals();
    loadReports();
    loadStrategy();
  }, [loadUser, loadPlans, loadEntries, loadMeals, loadReports, loadStrategy, router]);

  const profile = user || mockUser;
  const todayPlan = getTodayPlan(plans);
  const color = todayPlan ? carbColors[todayPlan.carbType] : carbColors.low;
  const burnIndex = todayPlan ? getFatBurnIndex(todayPlan.carbType, todayPlan.completed) : 0;
  const mealSummary = getDailySummary(todayIso);
  const weights = useMemo(() => mergeInitialWeight(profile, weightEntries), [profile, weightEntries]);
  const latestWeight = weights[weights.length - 1];
  const prevWeight = weights.length >= 3 ? weights[weights.length - 3] : weights[0];
  const weightDiff = latestWeight && prevWeight ? latestWeight.weight - prevWeight.weight : 0;
  const chartEntries = weights.slice(-7);
  const chartWeights = chartEntries.map(entry => entry.weight);
  const minChartWeight = chartWeights.length ? Math.min(...chartWeights) : profile.weight - 1;
  const maxChartWeight = chartWeights.length ? Math.max(...chartWeights) : profile.weight + 1;
  const chartRange = Math.max(0.1, maxChartWeight - minChartWeight);
  const dayCount = Math.max(1, Math.floor((new Date(todayIso).getTime() - new Date(profile.startDate).getTime()) / 86400000) + 1);
  const hasUnreadReports = dailyReports.some(report => !report.readAt) || weeklyReports.some(report => !report.readAt);

  const saveWeight = () => {
    const weight = Number.parseFloat(weightValue);
    if (Number.isNaN(weight) || weight < 30 || weight > 250) {
      showAppToast('请输入 30-250 kg 之间的体重。', 'error');
      return;
    }

    addEntry({ date: todayIso, weight });
    setShowWeightInput(false);
    setWeightValue('');
    showAppToast('体重已保存。', 'success');
  };

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{ background: `radial-gradient(circle, ${color.main}08, transparent 70%)`, top: '-10%', right: '-30%' }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.48, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.2px]">Hi, {profile.name}</h1>
          <p className="text-[13px] text-text-tertiary mt-1">今天是你执行计划的第 {dayCount} 天</p>
        </div>
        <div className="flex gap-2">
          <button
            className="relative w-9 h-9 glass-card rounded-full flex items-center justify-center"
            onClick={() => {
              track('daily_report_view', { entry_point: 'dashboard_inbox', unread_count: dailyReports.filter(report => !report.readAt).length });
              track('weekly_report_view', { entry_point: 'dashboard_inbox', unread_count: weeklyReports.filter(report => !report.readAt).length });
              setShowInbox(true);
            }}
            aria-label="报告收件箱"
          >
            <Inbox size={16} className="text-text-secondary" />
            {hasUnreadReports && <span className="absolute right-0.5 top-0.5 w-2.5 h-2.5 rounded-full bg-carb-high border border-bg-primary" />}
          </button>
          <button
            className="w-9 h-9 glass-card rounded-full flex items-center justify-center"
            onClick={() => setShowSettings(true)}
            aria-label="设置"
          >
            <Settings size={16} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {(currentStrategy || recommendation) && (
        <GlassCard variant="highlight" className="mb-3 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-accent-blue" />
              <span className="text-[13px] font-medium">AI 减脂策略</span>
            </div>
            <button onClick={() => void recheckStrategy()} className="text-[11px] text-accent-blue bg-transparent border-none">
              重新评估
            </button>
          </div>
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="text-[24px] font-bold">{strategyLabel(currentStrategy?.strategyType || recommendation?.strategyType)}</p>
              <p className="text-[12px] text-text-tertiary mt-1">{currentStrategy?.stageGoal || recommendation?.stageGoal}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[20px] font-bold text-carb-low">{executionRate}%</p>
              <p className="text-[10px] text-text-tertiary">执行率</p>
            </div>
          </div>
          <div className="rounded-xl bg-white/55 border border-border-glass px-3 py-2.5">
            <p className="text-[12px] text-text-secondary leading-relaxed">
              {currentStrategy?.recommendationReasons?.[0] || recommendation?.reasons?.[0] || recommendation?.userFacingMessage || 'AI 会根据你的画像、记录和进度动态调整策略。'}
            </p>
          </div>
          {strategyProposals[0] && (
            <p className="text-[12px] text-carb-high mt-3">{strategyProposals[0].title}：{strategyProposals[0].summary}</p>
          )}
        </GlassCard>
      )}

      {todayPlan && (
        <GlassCard variant="highlight" className="mb-3 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: color.main, boxShadow: `0 0 8px ${color.main}` }} />
              <span className="text-[13px] font-medium" style={{ color: color.main }}>{carbLabel[todayPlan.carbType]}</span>
            </div>
            <span className="text-[11px] text-text-tertiary">{todayPlan.trainingLabel || '今日计划'}</span>
          </div>

          <div className="flex items-center gap-6 mb-4">
            <div className="flex-shrink-0">
              <motion.div
                className="text-[56px] font-bold leading-none gradient-accent-text"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {burnIndex}
              </motion.div>
              <p className="text-[11px] text-text-tertiary mt-1">燃脂指数 / 100</p>
            </div>
            <div className="flex-1 flex justify-center">
              <RingChart
                size={120}
                centerValue={todayPlan.calories.toLocaleString()}
                centerLabel="kcal"
                rings={[
                  { value: macroPercent(mealSummary.carb, todayPlan.carb), color: '#68B96C', label: '碳水', current: `${Math.round(mealSummary.carb)}`, target: `${todayPlan.carb}g` },
                  { value: macroPercent(mealSummary.protein, todayPlan.protein), color: '#67B56B', label: '蛋白', current: `${Math.round(mealSummary.protein)}`, target: `${todayPlan.protein}g` },
                  { value: macroPercent(mealSummary.fat, todayPlan.fat), color: '#F0B56E', label: '脂肪', current: `${Math.round(mealSummary.fat)}`, target: `${todayPlan.fat}g` },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/55 border border-border-glass">
            <Brain size={14} className="text-accent-blue flex-shrink-0" />
            <p className="text-[12px] text-text-secondary font-medium">{carbTip[todayPlan.carbType]}</p>
          </div>
        </GlassCard>
      )}

      {todayPlan && (
        <GlassCard className="mb-3 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Utensils size={14} className="text-accent-blue" />
              <span className="text-[13px] font-medium">今日摄入</span>
            </div>
            <button onClick={() => router.push('/meals')} className="text-[12px] text-accent-blue bg-transparent border-none cursor-pointer">
              记饮食
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <IntakeStat label="碳水" current={mealSummary.carb} target={todayPlan.carb} color="#68B96C" />
            <IntakeStat label="蛋白" current={mealSummary.protein} target={todayPlan.protein} color="#67B56B" />
            <IntakeStat label="脂肪" current={mealSummary.fat} target={todayPlan.fat} color="#F0B56E" />
          </div>
        </GlassCard>
      )}

      <GlassCard className="mb-3 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingDown size={14} className="text-carb-low" />
            <span className="text-[13px] font-medium">体重趋势</span>
          </div>
          <span className="text-[11px] text-text-tertiary">近 7 天</span>
        </div>
        <div className="flex items-end justify-between gap-1 h-12 mb-2">
          {chartEntries.map((entry, index) => {
            const height = ((entry.weight - minChartWeight) / chartRange) * 100;
            return (
              <motion.div
                key={`${entry.date}-${index}`}
                className="flex-1 rounded-sm"
                style={{ background: index === chartEntries.length - 1 ? '#68B96C' : 'rgba(96,74,48,0.08)' }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(10, height)}%` }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[20px] font-bold">{latestWeight?.weight ?? profile.weight} kg</span>
          <span className={`text-[12px] font-medium ${weightDiff <= 0 ? 'text-carb-low' : 'text-carb-high'}`}>
            {weightDiff <= 0 ? '下降' : '上升'} {Math.abs(weightDiff).toFixed(1)} kg
          </span>
        </div>
      </GlassCard>

      <div className="grid grid-cols-3 gap-3 relative z-10">
        <ActionCard icon={Scale} label="记体重" color="#68B96C" onClick={() => setShowWeightInput(true)} />
        <ActionCard icon={MessageSquare} label="问 AI" color="#F0B56E" onClick={() => router.push('/chat')} />
        <ActionCard
          icon={CheckCircle2}
          label={todayPlan?.completed ? '已完成' : '今日完成'}
          color="#67B56B"
          onClick={() => {
            if (!todayPlan) return;
            toggleComplete(todayPlan.date);
            showAppToast(todayPlan.completed ? '已取消今日完成。' : '今日完成状态已更新。', 'success');
          }}
        />
      </div>

      {showWeightInput && (
        <ModalBackdrop onClose={() => setShowWeightInput(false)}>
          <p className="text-[16px] font-semibold mb-4">记录今日体重</p>
          <div className="flex items-center gap-2 mb-5">
            <input
              type="number"
              step="0.1"
              value={weightValue}
              onChange={(event) => setWeightValue(event.target.value)}
              placeholder={String(latestWeight?.weight || profile.weight)}
              className="flex-1 bg-transparent border border-border-glass rounded-xl px-4 py-3 text-[18px] font-bold text-text-primary outline-none focus:border-accent-blue transition-colors"
              autoFocus
            />
            <span className="text-[14px] text-text-tertiary">kg</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowWeightInput(false)} className="flex-1 py-3 rounded-xl border border-border-glass bg-transparent text-text-secondary text-[14px] cursor-pointer">
              取消
            </button>
            <button onClick={saveWeight} className="flex-1 py-3 rounded-xl gradient-accent text-white text-[14px] font-medium cursor-pointer border-none">
              保存
            </button>
          </div>
        </ModalBackdrop>
      )}

      {showSettings && (
        <ModalBackdrop onClose={() => setShowSettings(false)} maxWidth="max-w-[340px]">
          <p className="text-[16px] font-semibold mb-2">应用与数据</p>
          <p className="text-[12px] text-text-tertiary leading-relaxed mb-5">
            数据会先保存在本机，数据库可用时自动同步。Android Chrome 可将减脂助手安装到手机主屏幕。
          </p>
          <div className="flex flex-col gap-3">
            <InstallPrompt />
            <button
              onClick={() => {
                downloadLocalAppData();
                showAppToast('本地数据已导出。', 'success');
              }}
              className="py-3 rounded-xl gradient-accent text-white text-[14px] font-medium cursor-pointer border-none"
            >
              导出 JSON
            </button>
            <button onClick={() => router.push('/onboarding')} className="py-3 rounded-xl border border-border-glass bg-transparent text-text-secondary text-[14px] cursor-pointer">
              重新填写信息
            </button>
            <button
              onClick={() => {
                setShowSettings(false);
                router.push('/accounts');
              }}
              className="py-3 rounded-xl border border-border-glass bg-transparent text-text-secondary text-[14px] cursor-pointer"
            >
              切换账户
            </button>
            <button
              onClick={() => {
                clearActiveAccount();
                showAppToast('已退出当前账户。', 'success');
                router.push('/accounts');
              }}
              className="py-3 rounded-xl border border-border-glass bg-transparent text-text-secondary text-[14px] cursor-pointer"
            >
              退出当前账户
            </button>
            <button
              onClick={() => {
                clearLocalAppData();
                showAppToast('本地数据已清除。', 'success');
                router.push('/onboarding');
              }}
              className="py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 text-[14px] cursor-pointer"
            >
              清除本地数据
            </button>
            <button onClick={() => setShowSettings(false)} className="py-3 rounded-xl border border-border-glass bg-transparent text-text-tertiary text-[14px] cursor-pointer">
              关闭
            </button>
          </div>
        </ModalBackdrop>
      )}

      {showInbox && (
        <ReportInboxModal
          dailyReports={dailyReports}
          weeklyReports={weeklyReports}
          isLoading={reportsLoading}
          selectedReport={selectedReport}
          onClose={() => {
            setShowInbox(false);
            setSelectedReport(null);
          }}
          onBack={() => setSelectedReport(null)}
          onSelect={(item) => {
            setSelectedReport(item);
            markRead(item.type, item.report.id);
          }}
          onGenerateWeekly={async () => {
            const report = await generateWeeklyReport(true);
            if (report) {
              showAppToast('周报已生成。', 'success');
              setSelectedReport({ type: 'weekly', report });
            } else {
              showAppToast('周报暂时生成失败。', 'error');
            }
          }}
        />
      )}
    </div>
  );
}

function ReportInboxModal({
  dailyReports,
  weeklyReports,
  isLoading,
  selectedReport,
  onClose,
  onBack,
  onSelect,
  onGenerateWeekly,
}: {
  dailyReports: DailyReport[];
  weeklyReports: WeeklyReport[];
  isLoading: boolean;
  selectedReport: { type: 'daily'; report: DailyReport } | { type: 'weekly'; report: WeeklyReport } | null;
  onClose: () => void;
  onBack: () => void;
  onSelect: (item: { type: 'daily'; report: DailyReport } | { type: 'weekly'; report: WeeklyReport }) => void;
  onGenerateWeekly: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose} maxWidth="max-w-[390px]">
      {!selectedReport ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[16px] font-semibold">报告收件箱</p>
              <p className="text-[11px] text-text-tertiary mt-1">日报和周报会自动汇总在这里</p>
            </div>
            <button onClick={onGenerateWeekly} disabled={isLoading} className="rounded-full px-3 py-2 bg-white/55 border border-border-glass text-[12px] text-text-secondary">
              生成周报
            </button>
          </div>
          <ReportSection title="周报" empty="暂无周报">
            {weeklyReports.map(report => (
              <ReportListItem
                key={report.id}
                title={`第 ${report.weekIndex} 周 · ${report.score} 分`}
                subtitle={`${formatDate(report.startDate)} - ${formatDate(report.endDate)}`}
                summary={report.headline || report.summary}
                unread={!report.readAt}
                onClick={() => onSelect({ type: 'weekly', report })}
              />
            ))}
          </ReportSection>
          <ReportSection title="日报" empty="暂无日报">
            {dailyReports.map(report => (
              <ReportListItem
                key={report.id}
                title={`${formatDate(report.date)} · ${report.score} 分`}
                subtitle="每日复盘"
                summary={report.summary}
                unread={!report.readAt}
                onClick={() => onSelect({ type: 'daily', report })}
              />
            ))}
          </ReportSection>
        </div>
      ) : selectedReport.type === 'weekly' ? (
        <WeeklyReportDetail report={selectedReport.report} onBack={onBack} />
      ) : (
        <DailyReportDetail report={selectedReport.report} onBack={onBack} />
      )}
    </ModalBackdrop>
  );
}

function ReportSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="mb-5">
      <p className="text-[13px] text-text-secondary font-medium mb-2">{title}</p>
      <div className="flex flex-col gap-2">
        {hasChildren ? children : <p className="text-[12px] text-text-tertiary rounded-xl bg-white/55 border border-border-glass px-3 py-3">{empty}</p>}
      </div>
    </div>
  );
}

function ReportListItem({ title, subtitle, summary, unread, onClick }: { title: string; subtitle: string; summary: string; unread: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl border border-border-glass bg-white/55 px-3 py-3 text-left">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[13px] font-semibold">{title}</p>
        {unread && <span className="w-2 h-2 rounded-full bg-carb-high shrink-0" />}
      </div>
      <p className="text-[11px] text-text-tertiary mb-1">{subtitle}</p>
      <p className="text-[12px] text-text-secondary line-clamp-2">{summary}</p>
    </button>
  );
}

function WeeklyReportDetail({ report, onBack }: { report: WeeklyReport; onBack: () => void }) {
  const printableId = `weekly-report-${report.id}`;

  const exportPoster = async () => {
    const node = document.getElementById(printableId);
    if (!node) return;
    const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2 });
    downloadDataUrl(dataUrl, `fat-loss-weekly-poster-${report.startDate}.png`);
  };

  const exportPdf = async () => {
    const node = document.getElementById(printableId);
    if (!node) return;
    const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2 });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [1080, 1440] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, 1080, 1440);
    pdf.save(`fat-loss-weekly-report-${report.startDate}.pdf`);
  };

  return (
    <div>
      <button onClick={onBack} className="text-[12px] text-accent-blue mb-3">返回收件箱</button>
      <WeeklyReportPrintableCard report={report} printableId={printableId} />
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button onClick={exportPdf} className="rounded-xl py-3 gradient-accent text-white text-[13px] flex items-center justify-center gap-2">
          <FileText size={14} /> 导出 PDF
        </button>
        <button onClick={exportPoster} className="rounded-xl py-3 border border-border-glass bg-white/55 text-text-secondary text-[13px] flex items-center justify-center gap-2">
          <Share2 size={14} /> 分享海报
        </button>
      </div>
    </div>
  );
}

function WeeklyReportPrintableCard({ report, printableId }: { report: WeeklyReport; printableId: string }) {
  const metrics = report.metrics;
  const weightChange = metrics.weightChange !== undefined ? Math.abs(metrics.weightChange).toFixed(1) : '--';
  const weightTrend = metrics.weightChange !== undefined && metrics.weightChange <= 0 ? '本周减重' : '本周变化';

  return (
    <div
      id={printableId}
      className="rounded-2xl border border-border-glass-strong bg-[#FFFDF8] p-5 text-text-primary shadow-[0_18px_45px_rgba(104,83,55,0.12)]"
      style={{ width: 360, minHeight: 480 }}
    >
      <p className="text-[12px] text-text-tertiary mb-1">Fat Loss Assistant</p>
      <h2 className="text-[23px] font-bold mb-1">AI 减脂周报</h2>
      <p className="text-[12px] text-text-tertiary mb-5">{formatDate(report.startDate)} - {formatDate(report.endDate)}</p>
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-[12px] text-text-tertiary mb-1">本周评分</p>
          <p className="text-[48px] font-bold text-carb-low leading-none">{report.score}</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-text-tertiary mb-1">{weightTrend}</p>
          <p className="text-[26px] font-bold">{weightChange === '--' ? '--' : `${weightChange}kg`}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <PosterMetric label="体重" value={metrics.startWeight && metrics.endWeight ? `${metrics.startWeight} -> ${metrics.endWeight}kg` : '--'} />
        <PosterMetric label="平均热量" value={`${metrics.averageCalories} kcal`} />
        <PosterMetric label="蛋白达标" value={`${metrics.proteinHitRate}%`} />
        <PosterMetric label="连续打卡" value={`${metrics.longestStreak} 天`} />
      </div>
      <p className="text-[15px] font-semibold leading-relaxed mb-4">{report.headline || report.summary}</p>
      <p className="text-[13px] text-text-secondary leading-relaxed">{report.suggestions[0] || '下周继续保持记录节奏。'}</p>
      {metrics.predictionDays && <p className="text-[12px] text-carb-low mt-4">预计 {metrics.predictionDays} 天后达到目标体重</p>}
    </div>
  );
}

function PosterMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-glass border border-border-glass px-3 py-2">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className="text-[13px] font-semibold">{value}</p>
    </div>
  );
}

function DailyReportDetail({ report, onBack }: { report: DailyReport; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="text-[12px] text-accent-blue mb-3">返回收件箱</button>
      <div className="rounded-2xl border border-border-glass bg-glass p-4">
        <p className="text-[16px] font-semibold mb-1">{formatDate(report.date)} 日报 · {report.score} 分</p>
        <p className="text-[13px] text-text-secondary leading-relaxed mt-3">{report.summary}</p>
        <div className="flex flex-col gap-2 mt-4">
          {report.suggestions.map((item, index) => (
            <p key={index} className="rounded-xl bg-white/55 border border-border-glass px-3 py-2 text-[12px] text-text-secondary">{item}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, label, color, onClick }: { icon: LucideIcon; label: string; color: string; onClick: () => void }) {
  return (
    <GlassCard padding="p-3" className="flex flex-col items-center gap-2 cursor-pointer" whileTap={{ scale: 0.95 }} onClick={onClick}>
      <Icon size={20} style={{ color }} />
      <span className="text-[12px] text-text-secondary">{label}</span>
    </GlassCard>
  );
}

function ModalBackdrop({
  children,
  onClose,
  maxWidth = 'max-w-[320px]',
}: {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-8"
      style={{ background: 'rgba(42,38,31,0.38)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        className={`glass-card-elevated p-6 rounded-2xl w-full ${maxWidth}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function mergeInitialWeight(user: UserProfile, entries: WeightEntry[]): WeightEntry[] {
  const initialEntry = {
    date: user.initialWeightDate || user.startDate,
    weight: user.weight,
  };
  const byDate = new Map<string, WeightEntry>();
  entries.forEach(entry => byDate.set(entry.date, entry));
  byDate.set(initialEntry.date, initialEntry);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function IntakeStat({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const diff = Math.round(target - current);
  return (
    <div className="rounded-xl bg-glass px-3 py-3">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className="text-[16px] font-bold" style={{ color }}>{Math.round(current)}g</p>
      <p className="text-[10px] text-text-tertiary mt-1">{diff >= 0 ? `剩 ${diff}g` : `超 ${Math.abs(diff)}g`}</p>
    </div>
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}/${day}`;
}

function macroPercent(current: number, target: number) {
  return target > 0 ? Math.min(100, Math.max(0, Math.round((current / target) * 100))) : 0;
}

function strategyLabel(strategyType?: string): string {
  if (strategyType === 'calorie_deficit') return '热量缺口';
  if (strategyType === 'if_16_8') return '16+8 轻断食';
  if (strategyType === 'carb_cycling') return '碳循环';
  return '策略分析';
}
