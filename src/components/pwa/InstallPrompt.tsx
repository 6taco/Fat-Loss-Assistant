'use client';

import { useEffect, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { BeforeInstallPromptEvent, getPwaStatus, isStandalonePwa } from '@/lib/pwa';
import { showAppToast } from '@/components/ui/ToastHost';

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandalonePwa());
  const [statusText, setStatusText] = useState('检测安装环境中');

  useEffect(() => {
    void getPwaStatus().then((status) => {
      if (status.standalone) setStatusText('已从主屏幕独立窗口打开');
      else if (status.serviceWorker && status.manifest) setStatusText('已具备安装条件');
      else setStatusText('部署到 HTTPS 后可安装');
    });

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setStatusText('可安装到手机主屏幕');
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
      showAppToast('减脂助手已安装到手机。', 'success');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) {
      showAppToast('如果没有出现安装按钮，请在 Android Chrome 菜单中选择“添加到主屏幕”。', 'info');
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setPromptEvent(null);
      showAppToast('安装已开始。', 'success');
    } else {
      showAppToast('已取消安装。', 'info');
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-glass px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isInstalled ? <CheckCircle2 size={16} className="text-carb-low shrink-0" /> : <Download size={16} className="text-accent-blue shrink-0" />}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{isInstalled ? '已安装' : '安装到手机'}</p>
            <p className="text-[11px] text-text-tertiary mt-0.5">{statusText}</p>
          </div>
        </div>
        {!isInstalled && (
          <button
            onClick={install}
            className="h-9 px-4 rounded-full gradient-accent text-white text-[12px] font-semibold border-none shrink-0"
          >
            安装
          </button>
        )}
      </div>
    </div>
  );
}
