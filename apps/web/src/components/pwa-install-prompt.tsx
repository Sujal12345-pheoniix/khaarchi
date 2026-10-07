'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already running standalone as PWA
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    // 2. Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration skipped/failed:', err);
        });
    }

    // 4. Capture native install prompt
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

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instruction dialog for browsers that don't emit beforeinstallprompt
      setShowIosModal(true);
    }
  };

  // Don't render button if already running in standalone PWA mode
  if (isStandalone || installed) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition shadow-sm active:scale-95 shrink-0"
        title="Install mobile app on your phone"
      >
        <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
        <span className="hidden sm:inline">Install Mobile App</span>
        <span className="sm:hidden">Install App</span>
      </button>

      {/* iOS & Browser Installation Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
                  HE
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Install HomeExpense</h3>
                  <p className="text-[11px] text-slate-500">Mobile Home Screen App</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <p className="font-medium text-slate-900">
                You can add this web app to your mobile phone with 2 quick taps:
              </p>

              {isIos ? (
                <div className="space-y-2.5 bg-slate-50 rounded-2xl p-3.5 border border-slate-200">
                  <div className="flex items-start space-x-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      1
                    </span>
                    <p className="flex items-center gap-1.5">
                      Tap the <strong className="inline-flex items-center gap-1 text-slate-900"><Share className="h-3.5 w-3.5 text-blue-600" /> Share</strong> button in Safari's bottom toolbar.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      2
                    </span>
                    <p className="flex items-center gap-1.5">
                      Scroll down and tap <strong className="inline-flex items-center gap-1 text-slate-900"><PlusSquare className="h-3.5 w-3.5 text-slate-800" /> Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 bg-slate-50 rounded-2xl p-3.5 border border-slate-200">
                  <div className="flex items-start space-x-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      1
                    </span>
                    <p>
                      Tap your browser's menu (three dots <strong>⋮</strong> in the top-right corner).
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      2
                    </span>
                    <p>
                      Select <strong className="text-slate-900">Install app</strong> or <strong className="text-slate-900">Add to Home screen</strong>.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Instant launch with full screen & offline support</span>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm active:scale-98"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
