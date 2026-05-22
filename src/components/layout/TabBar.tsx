'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Calendar, ClipboardList, Home, MessageSquare, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'dashboard', label: '首页', icon: Home, path: '/dashboard' },
  { id: 'plan', label: '计划', icon: ClipboardList, path: '/plan' },
  { id: 'meals', label: '饮食', icon: Utensils, path: '/meals' },
  { id: 'calendar', label: '日历', icon: Calendar, path: '/calendar' },
  { id: 'chat', label: 'AI', icon: MessageSquare, path: '/chat' },
  { id: 'trends', label: '趋势', icon: BarChart3, path: '/trends' },
];

export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    tabs.forEach(tab => router.prefetch(tab.path));
  }, [router]);

  if (pathname === '/' || pathname.startsWith('/onboarding') || pathname.startsWith('/accounts')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 tab-bar-blur">
      <div className="max-w-[430px] mx-auto flex items-start justify-around pt-2.5 pb-7 px-1">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={active ? pathname : tab.path}
              prefetch
              onClick={(event) => {
                if (active) event.preventDefault();
              }}
              className={cn(
                'flex flex-col items-center gap-1 min-w-[42px] bg-transparent border-none cursor-pointer transition-all active:scale-95',
                active ? 'text-accent-blue' : 'text-text-tertiary',
              )}
              aria-label={tab.label}
            >
              <Icon
                size={22}
                strokeWidth={1.8}
                className={cn(active && 'drop-shadow-[0_0_6px_rgba(10,132,255,0.5)]')}
              />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
