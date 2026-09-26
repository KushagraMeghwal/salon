import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Chrome/Edge/Samsung Internet install prompt (not in the TS DOM lib yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __chairlyInstallPrompt?: BeforeInstallPromptEvent;
  }
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';

const SNOOZE_KEY = 'chairly.install.snoozeUntil';
const SNOOZE_DAYS = 7;
/** Wait a moment before nudging so the banner never covers a page that is still loading. */
const NUDGE_DELAY_MS = 4000;

/**
 * Makes Chairly installable as an app for owners, stylists and customers.
 * - Android / desktop Chromium: keeps the browser's install prompt and replays it from our own button.
 * - iPhone / iPad Safari: there is no prompt API, so `iosHelp` shows the "Share → Add to Home Screen" steps.
 * - Also surfaces "a new version is ready" when the service worker has downloaded an update.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly doc = inject(DOCUMENT);
  private readonly win = this.doc.defaultView;
  // Optional: tests and non-SW environments still get install support.
  private readonly sw = inject(SwUpdate, { optional: true });

  private readonly deferred = signal<BeforeInstallPromptEvent | null>(null);
  private readonly ready = signal(false);
  private readonly snoozedUntil = signal(this.readSnooze());

  readonly installed = signal(this.detectStandalone());
  readonly platform: InstallPlatform = this.detectPlatform();
  readonly iosHelp = signal(false);
  readonly updateReady = signal(false);

  /** iOS Safari can always add to the home screen; other browsers only once they hand us a prompt. */
  private readonly iosCanInstall = this.platform === 'ios' && this.isIosSafari();
  readonly canInstall = computed(() => !this.installed() && (!!this.deferred() || this.iosCanInstall));
  /** The soft banner: installable, not snoozed, and the page had a few seconds to settle. */
  readonly showNudge = computed(() => this.ready() && this.canInstall() && Date.now() > this.snoozedUntil());

  constructor() {
    const w = this.win;
    if (!w) return;
    if (w.__chairlyInstallPrompt) this.deferred.set(w.__chairlyInstallPrompt);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      this.deferred.set(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      this.installed.set(true);
      this.deferred.set(null);
      this.iosHelp.set(false);
    };
    w.addEventListener('beforeinstallprompt', onPrompt);
    w.addEventListener('appinstalled', onInstalled);
    const mq = w.matchMedia?.('(display-mode: standalone)');
    const onMode = () => this.installed.set(this.detectStandalone());
    mq?.addEventListener?.('change', onMode);
    const timer = setTimeout(() => this.ready.set(true), NUDGE_DELAY_MS);

    inject(DestroyRef).onDestroy(() => {
      w.removeEventListener('beforeinstallprompt', onPrompt);
      w.removeEventListener('appinstalled', onInstalled);
      mq?.removeEventListener?.('change', onMode);
      clearTimeout(timer);
    });

    if (this.sw?.isEnabled) {
      this.sw.versionUpdates.pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY')).subscribe(() => this.updateReady.set(true));
      this.sw.unrecoverable.subscribe(() => this.updateReady.set(true));
    }
  }

  /** Opens the native install dialog, or the iOS instructions. Resolves true when the app was installed. */
  async install(): Promise<boolean> {
    const e = this.deferred();
    if (e) {
      await e.prompt();
      const { outcome } = await e.userChoice;
      // A prompt event can only be used once.
      this.deferred.set(null);
      if (this.win) this.win.__chairlyInstallPrompt = undefined;
      if (outcome === 'accepted') {
        this.installed.set(true);
        return true;
      }
      this.snooze();
      return false;
    }
    if (this.iosCanInstall) this.iosHelp.set(true);
    return false;
  }

  /** "Not now": hides the banner for a week. The install button in profile / sidebar stays available. */
  snooze() {
    const until = Date.now() + SNOOZE_DAYS * 86_400_000;
    this.snoozedUntil.set(until);
    try {
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {
      /* private mode: snoozed for this visit only */
    }
  }

  async applyUpdate() {
    try {
      if (this.sw?.isEnabled) await this.sw.activateUpdate();
    } finally {
      this.doc.location.reload();
    }
  }

  private readSnooze(): number {
    try {
      return Number(localStorage.getItem(SNOOZE_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  private detectStandalone(): boolean {
    const w = this.win;
    if (!w) return false;
    return !!w.matchMedia?.('(display-mode: standalone)').matches || !!w.matchMedia?.('(display-mode: minimal-ui)').matches || (w.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  private detectPlatform(): InstallPlatform {
    const nav = this.win?.navigator;
    const ua = nav?.userAgent ?? '';
    // iPadOS 13+ reports itself as a Mac; touch support gives it away.
    if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (nav?.maxTouchPoints ?? 0) > 1)) return 'ios';
    return /android/i.test(ua) ? 'android' : 'desktop';
  }

  /** Only Safari can add to the iOS home screen; Chrome/Firefox on iOS (CriOS/FxiOS) and in-app browsers cannot. */
  private isIosSafari(): boolean {
    const ua = this.win?.navigator.userAgent ?? '';
    return /safari/i.test(ua) && !/crios|fxios|edgios|opios|instagram|fban|fbav|line\//i.test(ua);
  }
}
