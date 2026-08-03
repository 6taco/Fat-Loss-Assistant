'use client';

import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowRight, ArrowUpRight, TrendingDown } from 'lucide-react';
import type { WeightEntry } from '@/lib/mock-data';
import GlassCard from '@/components/ui/GlassCard';

const chartWidth = 320;
const chartHeight = 112;
const plotTop = 12;
const plotBottom = 76;
const plotLeft = 10;
const plotRight = 310;

interface WeightTrendCardProps {
  entries: WeightEntry[];
  fallbackWeight: number;
}

export default function WeightTrendCard({ entries, fallbackWeight }: WeightTrendCardProps) {
  const points = buildChartPoints(entries);
  const linePath = buildSmoothPath(points);
  const areaPath = points.length === 1
    ? `M ${plotLeft} ${points[0].y} L ${plotRight} ${points[0].y} L ${plotRight} ${plotBottom} L ${plotLeft} ${plotBottom} Z`
    : points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${plotBottom} L ${points[0].x} ${plotBottom} Z`
      : '';
  const latest = entries[entries.length - 1];
  const first = entries[0];
  const change = latest && first ? latest.weight - first.weight : 0;
  const isStable = Math.abs(change) < 0.05;
  const ChangeIcon = isStable ? ArrowRight : change < 0 ? ArrowDownRight : ArrowUpRight;
  const changeLabel = isStable ? '保持稳定' : `${change < 0 ? '下降' : '上升'} ${Math.abs(change).toFixed(1)} kg`;
  const changeTone = isStable
    ? 'bg-[#F2F0EB] text-text-secondary'
    : change < 0
      ? 'bg-[#EAF6E8] text-[#4F9D58]'
      : 'bg-[#FFF0E8] text-[#DF7449]';

  return (
    <GlassCard className="mb-3 relative z-10 overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF6E8]">
              <TrendingDown size={14} strokeWidth={2.2} className="text-[#5DAE64]" />
            </span>
            <span className="text-[13px] font-semibold">体重趋势</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold leading-none tracking-normal text-text-primary">
              {latest?.weight ?? fallbackWeight}
            </span>
            <span className="text-[12px] font-medium text-text-tertiary">kg</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="text-[11px] text-text-tertiary">近 7 次记录</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${changeTone}`}>
            <ChangeIcon size={12} strokeWidth={2.2} />
            {changeLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#FAFBF7] px-2 pt-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`近 7 次体重趋势，当前 ${latest?.weight ?? fallbackWeight} 千克，${changeLabel}`}
        >
          <defs>
            <linearGradient id="dashboardWeightArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#68B96C" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#68B96C" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[plotTop, (plotTop + plotBottom) / 2, plotBottom].map(y => (
            <line
              key={y}
              x1={plotLeft}
              y1={y}
              x2={plotRight}
              y2={y}
              stroke="rgba(96,74,48,0.08)"
              strokeWidth="1"
              strokeDasharray="3 5"
            />
          ))}

          {areaPath && (
            <motion.path
              d={areaPath}
              fill="url(#dashboardWeightArea)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55 }}
            />
          )}
          {linePath && (
            <motion.path
              d={linePath}
              fill="none"
              stroke="#68B96C"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          )}

          {points.map((point, index) => {
            const isLatest = index === points.length - 1;
            return (
              <g key={`${point.date}-${point.weight}`}>
                <circle cx={point.x} cy={point.y} r={isLatest ? 6 : 3.5} fill={isLatest ? '#FFFFFF' : '#F8FCF6'} stroke="#68B96C" strokeWidth={isLatest ? 3 : 2} />
                <text x={point.x} y="99" textAnchor="middle" fill="rgba(42,38,31,0.45)" fontSize="9.5">
                  {formatDate(point.date)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-text-tertiary">
        <span>{first ? `起始 ${first.weight} kg` : '记录体重后生成趋势'}</span>
        <span>{latest ? `更新于 ${formatDate(latest.date)}` : ''}</span>
      </div>
    </GlassCard>
  );
}

function buildChartPoints(entries: WeightEntry[]) {
  if (!entries.length) return [];
  const weights = entries.map(entry => entry.weight);
  const observedMin = Math.min(...weights);
  const observedMax = Math.max(...weights);
  const padding = Math.max(0.25, (observedMax - observedMin) * 0.22);
  const min = observedMin - padding;
  const max = observedMax + padding;
  const range = Math.max(0.5, max - min);

  return entries.map((entry, index) => ({
    ...entry,
    x: entries.length === 1
      ? chartWidth / 2
      : plotLeft + index * ((plotRight - plotLeft) / (entries.length - 1)),
    y: plotBottom - ((entry.weight - min) / range) * (plotBottom - plotTop),
  }));
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${plotLeft} ${points[0].y} L ${plotRight} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

function formatDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}/${day}`;
}
