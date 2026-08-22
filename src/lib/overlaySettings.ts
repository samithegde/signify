import { useCallback, useEffect, useState } from "react";

export type OverlayMode = "sign-to-words" | "words-to-sign";

export type OverlaySettings = {
  mode: OverlayMode;
  opacity: number;
  voiceOn: boolean;
};

declare global {
  interface Window {
    overlay?: {
      isElectron: boolean;
      toggleClickThrough: () => Promise<boolean>;
      setClickThrough: (enabled: boolean) => Promise<boolean>;
      setOverlayVisible?: (visible: boolean) => Promise<boolean>;
      getOverlayVisible?: () => Promise<boolean>;
      onOverlayVisibilityChanged?: (
        callback: (visible: boolean) => void,
      ) => () => void;
      openDashboard?: () => Promise<void>;
      getSettings?: () => Promise<Partial<OverlaySettings>>;
      updateSettings?: (
        patch: Partial<OverlaySettings>,
      ) => Promise<OverlaySettings>;
      onSettingsChanged?: (
        callback: (settings: OverlaySettings) => void,
      ) => () => void;
      getLaunchOnStartup?: () => Promise<boolean>;
      setLaunchOnStartup?: (enabled: boolean) => Promise<boolean>;
      quit: () => Promise<void>;
      dragStart?: () => Promise<void>;
      dragEnd?: () => Promise<void>;
      resizeStart?: () => Promise<void>;
      resizeEnd?: () => Promise<void>;
    };
  }
}

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  mode: "sign-to-words",
  opacity: 68,
  voiceOn: true,
};

const STORAGE_KEY = "signify-overlay-settings";
const CHANNEL_NAME = "signify-overlay-settings";

function normalizeSettings(
  settings: Partial<OverlaySettings>,
): OverlaySettings {
  return {
    mode:
      settings.mode === "words-to-sign" || settings.mode === "sign-to-words"
        ? settings.mode
        : DEFAULT_OVERLAY_SETTINGS.mode,
    opacity:
      typeof settings.opacity === "number"
        ? Math.min(90, Math.max(42, Math.round(settings.opacity)))
        : DEFAULT_OVERLAY_SETTINGS.opacity,
    voiceOn:
      typeof settings.voiceOn === "boolean"
        ? settings.voiceOn
        : DEFAULT_OVERLAY_SETTINGS.voiceOn,
  };
}

function readStoredSettings() {
  try {
    return normalizeSettings(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"),
    );
  } catch {
    return DEFAULT_OVERLAY_SETTINGS;
  }
}

function storeSettings(settings: OverlaySettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useOverlaySettings() {
  const [settings, setSettings] = useState(DEFAULT_OVERLAY_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void window.overlay?.getSettings?.().then((next) => {
      if (!cancelled) setSettings(normalizeSettings(next ?? {}));
    });

    if (!window.overlay?.getSettings) {
      setSettings(readStoredSettings());
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.overlay?.onSettingsChanged?.((next) => {
      setSettings(normalizeSettings(next ?? {}));
    });

    const channel =
      "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    channel?.addEventListener("message", (event) => {
      setSettings(normalizeSettings(event.data ?? {}));
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSettings(readStoredSettings());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      unsubscribe?.();
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<OverlaySettings>) => {
    setSettings((current) => {
      const next = normalizeSettings({ ...current, ...patch });

      if (window.overlay?.updateSettings) {
        void window.overlay.updateSettings(patch);
      } else {
        storeSettings(next);
        if ("BroadcastChannel" in window) {
          const channel = new BroadcastChannel(CHANNEL_NAME);
          channel.postMessage(next);
          channel.close();
        }
      }

      return next;
    });
  }, []);

  return [settings, updateSettings] as const;
}
