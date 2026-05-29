'use client';

import { useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Activity, Leaf, Sparkles, Utensils } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getActiveAccount } from '@/lib/accounts';
import { UserProfile } from '@/lib/mock-data';
import { getItem, KEYS } from '@/lib/storage';

gsap.registerPlugin(useGSAP);

const particles = [
  { left: '9%', top: '19%', size: 8, color: '#8BCF80', delay: 0 },
  { left: '22%', top: '68%', size: 5, color: '#F0B56E', delay: 0.3 },
  { left: '36%', top: '12%', size: 4, color: '#9AD98E', delay: 0.6 },
  { left: '58%', top: '23%', size: 7, color: '#F4C45F', delay: 0.15 },
  { left: '76%', top: '14%', size: 5, color: '#7BCB74', delay: 0.8 },
  { left: '88%', top: '52%', size: 9, color: '#F0B56E', delay: 0.45 },
  { left: '16%', top: '45%', size: 4, color: '#68B96C', delay: 0.9 },
  { left: '65%', top: '74%', size: 6, color: '#9AD98E', delay: 0.2 },
  { left: '83%', top: '82%', size: 4, color: '#F4C45F', delay: 1.1 },
  { left: '42%', top: '84%', size: 5, color: '#68B96C', delay: 0.65 },
];

export default function LandingPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    gsap.set('.landing-panel', { y: 28, autoAlpha: 0 });
    gsap.set('.particle', { scale: 0.4, autoAlpha: 0 });

    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .to('.particle', {
        autoAlpha: reduceMotion ? 0.28 : 0.78,
        scale: 1,
        duration: reduceMotion ? 0 : 0.65,
        stagger: { each: 0.04, from: 'random' },
      })
      .to('.landing-panel', { y: 0, autoAlpha: 1, duration: reduceMotion ? 0 : 0.78 }, '-=0.3')
      .from('.feature-chip', {
        y: 10,
        autoAlpha: 0,
        duration: reduceMotion ? 0 : 0.48,
        stagger: 0.08,
      }, '-=0.28');

    if (reduceMotion) return;

    gsap.to('.particle', {
      y: 'random(-34, 34)',
      x: 'random(-18, 18)',
      rotation: 'random(-16, 16)',
      duration: 'random(3.8, 6.2)',
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger: { each: 0.11, from: 'random' },
    });

    gsap.to('.hero-orbit', {
      rotation: 360,
      duration: 18,
      repeat: -1,
      ease: 'none',
      transformOrigin: '50% 50%',
    });

    gsap.to('.hero-card', {
      y: -8,
      duration: 3.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }, { scope: rootRef });

  const start = () => {
    const account = getActiveAccount();
    if (!account) {
      router.push('/accounts');
      return;
    }

    const user = getItem<UserProfile | null>(`fla:${account.id}:${KEYS.USER}`, null);
    router.push(user ? '/dashboard' : '/onboarding');
  };

  return (
    <div ref={rootRef} className="relative min-h-dvh overflow-hidden px-6 py-8">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-24 -top-16 h-72 w-72 rounded-full bg-[#FFE2BC]/70 blur-3xl" />
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-[#DDF2CF]/80 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-[#FFF3D9]/80 blur-3xl" />
        {particles.map((particle, index) => (
          <span
            key={index}
            className="particle absolute rounded-full will-change-transform"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              background: particle.color,
              boxShadow: `0 0 18px ${particle.color}66`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      <section className="landing-panel relative z-10 flex min-h-[calc(100dvh-64px)] flex-col justify-between">
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-[13px] font-medium text-text-tertiary">AI 饮食与体重管理</p>
            <h1 className="mt-1 text-[34px] font-bold leading-tight tracking-normal text-text-primary">轻燃AI</h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-[0_10px_24px_rgba(104,83,55,0.1)]">
            <Leaf size={21} strokeWidth={2} className="text-accent-blue" />
          </div>
        </div>

        <div className="relative mx-auto my-8 flex w-full max-w-[340px] items-center justify-center">
          <div className="hero-orbit absolute h-[280px] w-[280px] rounded-full border border-dashed border-[#A7D59D]/55" />
          <div className="hero-orbit absolute h-[214px] w-[214px] rounded-full border border-dashed border-[#F0B56E]/30 [animation-direction:reverse]" />

          <div className="hero-card relative w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/[0.82] px-5 py-5 shadow-[0_24px_58px_rgba(104,83,55,0.14)] backdrop-blur-xl will-change-transform">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[13px] font-medium text-text-tertiary">今日状态</p>
                <p className="mt-1 text-[26px] font-bold text-text-primary">轻盈执行中</p>
              </div>
              <span className="rounded-full bg-carb-low-bg px-3 py-1 text-[12px] font-semibold text-carb-low">
                78%
              </span>
            </div>

            <div className="mb-5 flex items-end gap-4">
              <div className="relative h-[128px] w-[128px] shrink-0 rounded-full bg-[#F5F0E8] p-3">
                <div className="h-full w-full rounded-full border-[12px] border-[#EBDCCC]" />
                <div className="absolute inset-3 rounded-full border-[12px] border-transparent border-l-[#75C777] border-t-[#75C777] rotate-[-35deg]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[28px] font-bold text-text-primary">1260</span>
                  <span className="text-[12px] text-text-tertiary">/ 1800 kcal</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <Metric icon={<Activity size={15} />} label="运动消耗" value="320 kcal" />
                <Metric icon={<Utensils size={15} />} label="饮食摄入" value="940 kcal" warm />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <FeatureChip label="计划" value="12周" />
              <FeatureChip label="饮水" value="1500ml" />
              <FeatureChip label="体重" value="-0.5kg" />
            </div>
          </div>
        </div>

        <div className="pb-3 text-center">
          <div className="mb-7 rounded-[24px] bg-[#FFF1DC]/[0.78] px-5 py-4 text-left shadow-[0_12px_30px_rgba(104,83,55,0.08)]">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={17} className="text-accent-purple" />
              <span className="text-[14px] font-semibold text-text-primary">今天也要好好爱自己</span>
            </div>
            <p className="text-[13px] leading-6 text-text-secondary">
              用更柔和的方式追踪饮食、计划和趋势，让减脂变成每天都愿意完成的小事。
            </p>
          </div>

          <Button fullWidth onClick={start}>
            开始轻燃
          </Button>
          <button
            className="mt-4 border-none bg-transparent text-[13px] font-medium text-text-tertiary"
            onClick={start}
          >
            已有本地数据，直接进入
          </button>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  warm = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  warm?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2 shadow-[0_8px_18px_rgba(104,83,55,0.06)]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${warm ? 'bg-carb-high-bg text-carb-high' : 'bg-carb-low-bg text-carb-low'}`}>
        {icon}
      </span>
      <div>
        <p className="text-[11px] text-text-tertiary">{label}</p>
        <p className="text-[14px] font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function FeatureChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="feature-chip rounded-2xl bg-[#F8F5EC] px-3 py-3 text-center">
      <p className="text-[11px] text-text-tertiary">{label}</p>
      <p className="mt-1 text-[14px] font-bold text-text-primary">{value}</p>
    </div>
  );
}
