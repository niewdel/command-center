// Serwist service worker for Niewdel App.
//
// Brings back offline + repeat-visit asset caching after we dropped
// @ducanh2912/next-pwa to unlock Turbopack. Strategy: precache the
// static build assets, then runtime-cache pages with stale-while-
// revalidate so the PWA shell loads instantly on repeat visits while
// fresh content streams in the background.

/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
