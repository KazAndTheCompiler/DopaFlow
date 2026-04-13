import { useState, useCallback } from 'react';
import { APP_STORAGE_KEYS } from './appStorage';
import type { AppRoute } from '../appRoutes';

export interface OverlayState {
  inboxOpen: boolean;
  planOpen: boolean;
  shutdownOpen: boolean;
  onboardingOpen: boolean;
}

export interface OverlayController extends OverlayState {
  openInbox: () => void;
  closeInbox: () => void;
  openPlan: () => void;
  closePlan: () => void;
  openShutdown: () => void;
  closeShutdown: () => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  finishOnboarding: () => AppRoute;
  isPlanTransition: (route: AppRoute) => boolean;
  isShutdownTransition: (route: AppRoute) => boolean;
}

export function useOverlayController(): OverlayController {
  const [inboxOpen, setInboxOpen] = useState<boolean>(false);
  const [planOpen, setPlanOpen] = useState<boolean>(false);
  const [shutdownOpen, setShutdownOpen] = useState<boolean>(false);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(
    () => !localStorage.getItem(APP_STORAGE_KEYS.onboardingComplete),
  );

  const openInbox = useCallback(() => setInboxOpen(true), []);
  const closeInbox = useCallback(() => setInboxOpen(false), []);
  const openPlan = useCallback(() => {
    setShutdownOpen(false);
    setPlanOpen(true);
  }, []);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  const openShutdown = useCallback(() => {
    setPlanOpen(false);
    setShutdownOpen(true);
  }, []);
  const closeShutdown = useCallback(() => setShutdownOpen(false), []);
  const openOnboarding = useCallback(() => setOnboardingOpen(true), []);
  const closeOnboarding = useCallback(() => setOnboardingOpen(false), []);

  const finishOnboarding = useCallback((): AppRoute => {
    localStorage.setItem(APP_STORAGE_KEYS.onboardingComplete, '1');
    setOnboardingOpen(false);
    return 'today';
  }, []);

  const isPlanTransition = useCallback((route: AppRoute): boolean => {
    return route === 'plan';
  }, []);

  const isShutdownTransition = useCallback((route: AppRoute): boolean => {
    return route === 'shutdown';
  }, []);

  return {
    inboxOpen,
    planOpen,
    shutdownOpen,
    onboardingOpen,
    openInbox,
    closeInbox,
    openPlan,
    closePlan,
    openShutdown,
    closeShutdown,
    openOnboarding,
    closeOnboarding,
    finishOnboarding,
    isPlanTransition,
    isShutdownTransition,
  };
}
