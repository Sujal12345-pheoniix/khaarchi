'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already running standalone
    const checkStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true);
    setIsStandalone(!!checkStandalone);

    // 2. Check if iOS device
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration skipped:', err);
        });
    }

    // 4. Native beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerApkDownload = () => {
    const link = document.createElement('a');
    link.href = '/kharchi.apk';
    link.download = 'kharchi.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInstallClick = () => {
    // Show quick install/download hub
    setShowModal(true);
  };

  const handleNativePwaInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
        setShowModal(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || installed) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition shadow-sm active:scale-95 shrink-0"
        title="Download Kharchi App APK on your mobile"
      >
        <Download className="h-3.5 w-3.5 text-emerald-700 animate-bounce" />
        <span className="hidden sm:inline">Download App (APK)</span>
        <span className="sm:hidden">Download App</span>
      </button>

      {/* App Download & Install Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  KX
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Download Kharchi App</h3>
                  <p className="text-[11px] text-slate-500">Android APK & Mobile Web App</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Main Action: Direct APK Download */}
            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-xs font-bold">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Direct Mobile APK Download</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Download the complete native Android APK file directly to your mobile device and install it like any app.
                </p>
                <a
                  href="/kharchi.apk"
                  download="kharchi.apk"
                  onClick={triggerApkDownload}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-98 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download kharchi.apk</span>
                </a>
              </div>

              {/* Native PWA Quick Install Option if supported */}
              {deferredPrompt && (
                <button
                  onClick={handleNativePwaInstall}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Smartphone className="h-4 w-4 text-slate-700" />
                  <span>Install via Browser Prompt</span>
                </button>
              )}

              {/* iOS instructions */}
              {isIos && (
                <div className="space-y-2 bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900 text-[11px]">For iPhone / iPad (iOS):</p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
                      1
                    </span>
                    <p className="flex items-center gap-1">
                      Tap <strong className="inline-flex items-center gap-0.5 text-blue-600"><Share className="h-3 w-3" /> Share</strong> in Safari toolbar.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
                      2
                    </span>
                    <p className="flex items-center gap-1">
                      Tap <strong className="text-slate-900">Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px] text-slate-500 justify-center pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Verified APK • Fast & offline ready</span>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
