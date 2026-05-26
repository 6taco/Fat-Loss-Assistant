'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initAnalytics, setAnalyticsRoute } from '@/lib/analytics/client';

export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics(pathname);
  }, [pathname]);

  useEffect(() => {
    setAnalyticsRoute(pathname);
  }, [pathname]);

  return null;
}
