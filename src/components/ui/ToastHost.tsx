'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AppToastDetail {
  message: string;
  type?: 'info' | 'error' | 'success';
}

interface ToastState extends AppToastDetail {
  id: number;
}

export function showAppToast(message: string, type: AppToastDetail['type'] = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AppToastDetail>('app-toast', { detail: { message, type } }));
}

export default function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<AppToastDetail>).detail;
      setToast({ id: Date.now(), message: detail.message, type: detail.type || 'info' });
    };

    window.addEventListener('app-toast', onToast);
    return () => window.removeEventListener('app-toast', onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const borderColor = toast?.type === 'error'
    ? 'rgba(255,69,58,0.35)'
    : toast?.type === 'success'
      ? 'rgba(48,209,88,0.35)'
      : 'rgba(10,132,255,0.35)';

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed left-0 right-0 bottom-[96px] z-[80] px-5 pointer-events-none"
        >
          <div
            className="max-w-[390px] mx-auto rounded-xl px-4 py-3 text-[13px] text-text-primary shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            style={{
              background: 'rgba(18,18,26,0.96)',
              border: `1px solid ${borderColor}`,
              backdropFilter: 'blur(20px)',
            }}
          >
            {toast.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
