'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing, Clock, Scale, Sunset } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { showAppToast } from '@/components/ui/ToastHost';
import {
  DEFAULT_REMINDER_SETTINGS,
  loadReminderSettings,
  notificationPermission,
  requestReminderPermission,
  saveReminderSettings,
  showReminderNotification,
  type ReminderSettings,
} from '@/lib/reminders';

type PermissionState = NotificationPermission | 'unsupported';

export default function SettingsPage() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [permission, setPermission] = useState<PermissionState>('granted');

  useEffect(() => {
    // Deferred like the other pages: synchronous setState in an effect
    // cascades renders, and localStorage is not available during prerender.
    const timer = window.setTimeout(() => {
      setSettings(loadReminderSettings());
      setPermission(notificationPermission());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persist = (next: ReminderSettings) => {
    setSettings(next);
    saveReminderSettings(next);
  };

  const enableReminders = async () => {
    if (permission === 'unsupported') {
      showAppToast('当前浏览器不支持通知，无法开启提醒。', 'error');
      return;
    }
    let granted: NotificationPermission | 'unsupported' = permission;
    if (granted !== 'granted') {
      granted = await requestReminderPermission();
      setPermission(granted);
    }
    if (granted !== 'granted') {
      showAppToast('通知权限被拒绝，请在浏览器站点设置里允许通知后再开启。', 'error');
      return;
    }
    persist({ ...settings, enabled: true });
    showAppToast('提醒已开启。', 'success');
  };

  const sendTestNotification = async () => {
    if (permission !== 'granted') {
      showAppToast('请先开启通知权限。', 'error');
      return;
    }
    const sent = await showReminderNotification({
      kind: 'weight',
      title: '测试提醒',
      body: '这是一条测试通知，到点提醒会长这样。',
      tag: `fla-reminder-test-${Date.now()}`,
    });
    showAppToast(sent ? '测试通知已发送。' : '通知发送失败，请检查权限。', sent ? 'success' : 'error');
  };

  const permissionLabel = permission === 'granted'
    ? '通知权限已允许'
    : permission === 'denied'
      ? '通知权限被拒绝'
      : permission === 'unsupported'
        ? '浏览器不支持通知'
        : '通知权限未授权';

  return (
    <div className="px-5 pt-14 pb-28 min-h-dvh">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold">提醒设置</h1>
          <p className="text-[13px] text-text-tertiary mt-1">让教练在关键时刻主动找你</p>
        </div>
        <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center">
          <Bell size={18} className="text-white" />
        </div>
      </div>

      <GlassCard variant="highlight" className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">本地提醒</p>
            <p className="text-[12px] text-text-secondary leading-relaxed mt-1">
              到点后提醒你称重和晚间收尾。任务已完成时会自动跳过，不打扰。
            </p>
          </div>
          <Toggle checked={settings.enabled} onChange={checked => (checked ? void enableReminders() : persist({ ...settings, enabled: false }))} />
        </div>
        <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] ${permission === 'granted' ? 'bg-[#F3F8ED] text-carb-low' : 'bg-[#FFF7EB] text-[#C8873D]'}`}>
          {permissionLabel}
          {permission === 'denied' && '，请在浏览器/系统设置中允许本站通知'}
        </div>
      </GlassCard>

      <ReminderSlotCard
        icon={Scale}
        title="称重提醒"
        description="到点还没记录今天的体重时提醒一次"
        slot={settings.weight}
        disabled={!settings.enabled}
        onChange={slot => persist({ ...settings, weight: slot })}
      />

      <ReminderSlotCard
        icon={Sunset}
        title="晚间收尾提醒"
        description="饮食没记录或没打卡时，提醒你花一分钟收尾"
        slot={settings.evening}
        disabled={!settings.enabled}
        onChange={slot => persist({ ...settings, evening: slot })}
      />

      <button
        onClick={() => void sendTestNotification()}
        disabled={!settings.enabled || permission !== 'granted'}
        className="w-full py-3 mb-4 rounded-xl border border-border-glass bg-white/[0.045] text-text-secondary text-[14px] font-medium cursor-pointer disabled:opacity-50"
      >
        <BellRing size={15} className="inline mr-1.5 -mt-0.5" />
        发送测试通知
      </button>

      <GlassCard padding="p-4">
        <p className="text-[11px] text-text-tertiary leading-relaxed">
          提醒在应用处于运行状态（包括挂在后台）时生效，每类提醒每天最多一次。完全脱离应用的定时推送需要后续接入 Web Push，届时在这里开启即可。
        </p>
      </GlassCard>
    </div>
  );
}

function ReminderSlotCard({ icon: Icon, title, description, slot, disabled, onChange }: {
  icon: typeof Bell;
  title: string;
  description: string;
  slot: { enabled: boolean; time: string };
  disabled: boolean;
  onChange: (slot: { enabled: boolean; time: string }) => void;
}) {
  return (
    <GlassCard className="mb-4" padding="p-4">
      <div className={`flex items-start justify-between gap-3 ${disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF6E8] text-[#4F9D58]">
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{title}</p>
            <p className="text-[12px] text-text-tertiary leading-relaxed mt-1">{description}</p>
          </div>
        </div>
        <Toggle checked={slot.enabled} disabled={disabled} onChange={checked => onChange({ ...slot, enabled: checked })} />
      </div>
      <div className={`flex items-center gap-2 mt-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <Clock size={13} className="text-text-tertiary shrink-0" />
        <input
          type="time"
          value={slot.time}
          onChange={event => onChange({ ...slot, time: event.target.value || slot.time })}
          className="rounded-lg border border-border-glass bg-[#FAFBF7] px-3 py-1.5 text-[13px] text-text-primary outline-none transition-colors focus:border-accent-blue/45 focus:bg-white"
          aria-label={`${title}时间`}
        />
      </div>
    </GlassCard>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-[46px] h-[26px] rounded-full shrink-0 transition-colors cursor-pointer border-none disabled:cursor-not-allowed ${
        checked ? 'gradient-accent' : 'bg-black/15'
      }`}
    >
      <span
        className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[23px]' : 'left-[3px]'}`}
      />
    </button>
  );
}
