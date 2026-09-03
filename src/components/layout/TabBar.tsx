'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Brain, BrainCircuit, Calendar, ClipboardList, Home, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';

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
  const auth = useAuth();

  if (auth.status !== 'authenticated' || pathname === '/' || pathname.startsWith('/onboarding') || pathname.startsWith('/accounts') || pathname.startsWith('/auth/')) return null;

  // Calendar stays visible for every strategy: it carries check-in/back-fill,
  // which applies to calorie-deficit and fasting users too.
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 tab-bar-blur">
      <div className="max-w-[430px] mx-auto flex items-start justify-around pt-2.5 pb-7 px-1">
        {tabs.map((tab) => {
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
