'use client';

import { useEffect, useRef } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/components/auth/AuthProvider';

export default function DataInitProvider() {
  const { loadUser } = useUserStore();
  const auth = useAuth();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (auth.status === 'authenticated' && !hasInitialized.current) {
      loadUser();
      hasInitialized.current = true;
    }
    if (auth.status === 'anonymous') {
      useUserStore.getState().clearUser();
      hasInitialized.current = false;
    }
  }, [auth.status, loadUser]);

  return null;
}
