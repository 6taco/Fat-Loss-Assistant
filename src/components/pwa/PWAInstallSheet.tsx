'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { showAppToast } from '@/components/ui/ToastHost';

const FEATURES = [
  '像 App 一样使用',
  'AI 教练随时陪伴',
  '支持离线打开',
  '更快启动体验',
];

export default function PWAInstallSheet() {
  const { isVisible, install, dismiss } = usePwaInstall();

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) {
      showAppToast('轻燃AI 已添加到主屏幕 ✨', 'success');
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pwa-backdrop"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(42, 38, 31, 0.18)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            onClick={dismiss}
          />

          {/* Bottom Sheet */}
          <motion.div
            key="pwa-sheet"
            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 32, mass: 0.9 }}
          >
            <div
              className="pointer-events-auto w-full max-w-[430px] px-4 pb-8 pt-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  background: 'linear-gradient(160deg, rgba(255,253,250,0.97) 0%, rgba(247,255,243,0.95) 100%)',
                  borderRadius: '28px 28px 20px 20px',
                  border: '1px solid rgba(103,181,107,0.14)',
                  boxShadow: '0 -4px 40px rgba(104,83,55,0.10), 0 -1px 0 rgba(255,255,255,0.9) inset',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  overflow: 'hidden',
                  padding: '28px 24px 24px',
                }}
              >
                {/* Drag handle */}
                <div className="flex justify-center mb-6">
                  <div
                    style={{
                      width: 36,
                      height: 4,
                      borderRadius: 9999,
                      background: 'rgba(42,38,31,0.12)',
                    }}
                  />
                </div>

                {/* Decorative blobs */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -32,
                    right: -24,
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(103,181,107,0.13) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    left: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(240,181,110,0.10) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* App icon + title */}
                <div className="flex items-center gap-4 mb-5">
                  <img
                    src="/icons/icon-192.png"
                    alt="轻燃AI"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      boxShadow: '0 6px 18px rgba(103,181,107,0.22)',
                      flexShrink: 0,
                      objectFit: 'cover',
                    }}
                  />
                  <div>
                    <h2
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#2A261F',
                        lineHeight: 1.3,
                        letterSpacing: '-0.3px',
                      }}
                    >
                      安装轻燃AI到手机
                    </h2>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(42,38,31,0.55)',
                        marginTop: 3,
                        lineHeight: 1.4,
                      }}
                    >
                      获得更轻盈、更流畅的陪伴体验
                    </p>
                  </div>
                </div>

                {/* Feature list */}
                <div
                  style={{
                    background: 'rgba(255,255,255,0.62)',
                    border: '1px solid rgba(103,181,107,0.10)',
                    borderRadius: 16,
                    padding: '14px 16px',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 8px' }}>
                    {FEATURES.map((feat) => (
                      <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #75C777, #54A95D)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span style={{ fontSize: 13, color: 'rgba(42,38,31,0.72)', lineHeight: 1.3 }}>
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <motion.button
                    onClick={handleInstall}
                    whileTap={{ scale: 0.97 }}
                    animate={{
                      boxShadow: [
                        '0 8px 24px rgba(103,181,107,0.28)',
                        '0 12px 32px rgba(103,181,107,0.38)',
                        '0 8px 24px rgba(103,181,107,0.28)',
                      ],
                    }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: '100%',
                      height: 52,
                      borderRadius: 9999,
                      background: 'linear-gradient(135deg, #75C777 0%, #54A95D 52%, #F0B56E 100%)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: '0.2px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2v10M5 8l4 4 4-4M3 14h12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    立即安装
                  </motion.button>

                  <button
                    onClick={dismiss}
                    style={{
                      width: '100%',
                      height: 44,
                      borderRadius: 9999,
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(42,38,31,0.42)',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    稍后再说
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
