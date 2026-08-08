import { useCallback, useEffect, useRef, useState } from "react";

import {
  createDefaultSettings,
  loadSettings,
  saveSettings,
  type AppSettings,
} from "../../shared/settings";

const SAVE_DEBOUNCE_MS = 220;

/**
 * Loads extension settings, keeps local state, and debounces sync writes.
 * Flushes pending changes when the popup hides or unmounts.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const pendingSave = useRef<AppSettings | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadSettings()
      .catch(createDefaultSettings)
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        void saveSettings(loaded);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const flushPendingSave = useCallback(() => {
    if (!pendingSave.current) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    const next = pendingSave.current;
    pendingSave.current = null;
    saveTimer.current = null;
    void saveSettings(next);
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) flushPendingSave();
    }

    window.addEventListener("pagehide", flushPendingSave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushPendingSave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const queueSave = useCallback((next: AppSettings, immediate: boolean) => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    pendingSave.current = next;

    if (immediate) {
      pendingSave.current = null;
      saveTimer.current = null;
      void saveSettings(next);
      return;
    }

    saveTimer.current = window.setTimeout(() => {
      pendingSave.current = null;
      saveTimer.current = null;
      void saveSettings(next);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const update = useCallback(
    (mutator: (draft: AppSettings) => void, immediate = false) => {
      setSettings((current) => {
        if (!current) return current;
        const next = structuredClone(current);
        mutator(next);
        queueSave(next, immediate);
        return next;
      });
    },
    [queueSave],
  );

  return { settings, update };
}
