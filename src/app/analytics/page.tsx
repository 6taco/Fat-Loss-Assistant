'use client';

import { useEffect, useState } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import { getJson } from '@/lib/client-api';

type AnalyticsSummary = {
  kpis: Record<string, number>;
  funnel: Array<{ step: number; eventNames: string[]; users: number }>;
  trends: Array<Record<string, string | number>>;
  retention: Array<{ day: number; signUp: number; onboarding: number; plan: number }>;
  proposal: { viewed: number; accepted: number; dismissed: number; edited: number };
  platforms: Array<{ platform: string; count: number }>;
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    void getJson<{ summary: AnalyticsSummary }>(`/api/app-metrics?days=30`).then((data) => {
      if (data?.summary) setSummary(data.summary);
    });
  }, []);

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh">
      <div className="mb-6">
        <p className="text-[12px] text-text-tertiary mb-1">产品分析</p>
        <h1 className="text-[24px] font-semibold">AI Fat Loss Coach 数据看板</h1>
      </div>

      <Section title="核心指标">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="DAU" value={summary?.kpis.dau ?? 0} />
          <Metric label="WAU" value={summary?.kpis.wau ?? 0} />
          <Metric label="注册数" value={summary?.kpis.signUps ?? 0} />
          <Metric label="Onboarding 完成" value={summary?.kpis.onboardingCompleted ?? 0} />
          <Metric label="D1 留存" value={`${summary?.kpis.d1Retention ?? 0}%`} />
          <Metric label="D7 留存" value={`${summary?.kpis.d7Retention ?? 0}%`} />
          <Metric label="打卡率" value={`${summary?.kpis.checkInRate ?? 0}%`} />
          <Metric label="AI 使用率" value={`${summary?.kpis.aiUsageRate ?? 0}%`} />
          <Metric label="建议采纳率" value={`${summary?.kpis.proposalAcceptRate ?? 0}%`} />
        </div>
      </Section>

      <Section title="漏斗">
        <div className="flex flex-col gap-2">
          {summary?.funnel.map(step => (
            <GlassCard key={step.step} className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold">Step {step.step}</p>
                <p className="text-[11px] text-text-tertiary">{step.eventNames.join(' / ')}</p>
              </div>
              <p className="text-[18px] font-semibold">{step.users}</p>
            </GlassCard>
          )) || <Empty text="暂无漏斗数据" />}
        </div>
      </Section>

      <Section title="留存">
        <div className="grid grid-cols-3 gap-2">
          {summary?.retention.map(item => (
            <GlassCard key={item.day} className="text-center">
              <p className="text-[11px] text-text-tertiary mb-2">D{item.day}</p>
              <p className="text-[14px] font-semibold">注册 {item.signUp}%</p>
              <p className="text-[12px] text-text-secondary">Onboarding {item.onboarding}%</p>
              <p className="text-[12px] text-text-secondary">计划 {item.plan}%</p>
            </GlassCard>
          )) || <Empty text="暂无留存数据" />}
        </div>
      </Section>

      <Section title="建议效果">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="曝光" value={summary?.proposal.viewed ?? 0} />
          <Metric label="采纳" value={summary?.proposal.accepted ?? 0} />
          <Metric label="忽略" value={summary?.proposal.dismissed ?? 0} />
          <Metric label="编辑" value={summary?.proposal.edited ?? 0} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[13px] font-medium text-text-secondary mb-2">{title}</p>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <GlassCard>
      <p className="text-[11px] text-text-tertiary mb-2">{label}</p>
      <p className="text-[18px] font-semibold">{value}</p>
    </GlassCard>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[12px] text-text-tertiary rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">{text}</p>;
}
