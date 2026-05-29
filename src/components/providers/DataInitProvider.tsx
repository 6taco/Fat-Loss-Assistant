'use client';

import { useEffect, useRef } from 'react';
import { useUserStore } from '@/stores/useUserStore';

export default function DataInitProvider() {
  const { loadUser } = useUserStore();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      loadUser();
      hasInitialized.current = true;
    }
  }, [loadUser]);

  return null;
}
