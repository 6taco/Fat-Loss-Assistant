'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, Brain, BrainCircuit, Calendar, ClipboardList, Home, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getItem, KEYS } from '@/lib/storage';
import type { StrategyCurrentResponse } from '@/lib/strategy-engine/types';

const tabs = [
  { id: 'dashboard', label: '首页', icon: Home, path: '/dashboard' },
  { id: 'plan', label: '计划', icon: ClipboardList, path: '/plan' },
  { id: 'meals', label: '饮食', icon: Utensils, path: '/meals' },
  { id: 'calendar', label: '日历', icon: Calendar, path: '/calendar' },
  { id: 'coach', label: '教练', icon: Brain, path: '/coach' },
  { id: 'digital-twin', label: '分身', icon: BrainCircuit, path: '/digital-twin' },
  { id: 'trends', label: '趋势', icon: BarChart3, path: '/trends' },
];

export default function TabBar() {
  const pathname = usePathname();
  const [strategy, setStrategy] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setStrategy(getActiveStrategyType());
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('strategy-cache-change', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('strategy-cache-change', refresh);
    };
  }, []);

  if (pathname === '/' || pathname.startsWith('/onboarding') || pathname.startsWith('/accounts')) return null;

  const visibleTabs = strategy && strategy !== 'carb_cycling'
    ? tabs.filter(tab => tab.id !== 'calendar')
    : tabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 tab-bar-blur">
      <div className="max-w-[430px] mx-auto flex items-start justify-around pt-2.5 pb-7 px-1">
        {visibleTabs.map((tab) => {
          const active = pathname.startsWith(tab.path) || (tab.id === 'coach' && pathname.startsWith('/chat'));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={active ? pathname : tab.path}
              prefetch={false}
              onClick={(event) => {
                if (active) event.preventDefault();
              }}
              className={cn(
                'flex flex-col items-center gap-1 min-w-[38px] bg-transparent border-none cursor-pointer transition-all active:scale-95',
                active ? 'text-accent-blue' : 'text-text-tertiary',
              )}
              aria-label={tab.label}
            >
              <Icon
                size={21}
                strokeWidth={1.8}
                className={cn(active && 'drop-shadow-[0_4px_8px_rgba(103,181,107,0.35)]')}
              />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function getActiveStrategyType() {
  const account = getActiveAccount();
  if (!account) return null;
  const strategyData = getItem<StrategyCurrentResponse | null>(getScopedKey(KEYS.STRATEGY), null);
  const plans = getItem<Array<{ strategyType?: string }> | null>(getScopedKey(KEYS.PLAN), null);
  return strategyData?.strategy?.strategyType
    || strategyData?.recommendation?.strategyType
    || plans?.find(plan => plan.strategyType)?.strategyType
    || null;
}
