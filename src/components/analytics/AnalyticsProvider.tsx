'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getActiveAccount } from '@/lib/accounts';
import { identifyAnalyticsUser, initAnalytics, recordPageView } from '@/lib/analytics/client';

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const initialized = useRef(false);

  useEffect(() => {
    identifyAnalyticsUser(getActiveAccount()?.id);

    if (!initialized.current) {
      initAnalytics(pathname);
      initialized.current = true;
      return;
    }

    recordPageView(pathname);
  }, [pathname]);

  return null;
}
