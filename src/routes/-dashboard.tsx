import { useEffect, useState } from "react";
import {
  Activity,
  Eye,
  EyeOff,
  Hand,
  Keyboard,
  Monitor,
  Moon,
  Volume2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useOverlaySettings } from "@/lib/overlaySettings";
import signifyBrandmarkUrl from "../../assets/signifybrandmark.png?url";
import signifyWordmarkUrl from "../../assets/signifywordmark.png?url";

export function Dashboard() {
  const [settings, updateSettings] = useOverlaySettings();
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [launchOnStartup, setLaunchOnStartup] = useState(false);

  useEffect(() => {
    void window.overlay?.getLaunchOnStartup?.().then((enabled) => {
      if (typeof enabled === "boolean") setLaunchOnStartup(enabled);
    });
  }, []);

  useEffect(() => {
    void window.overlay?.getOverlayVisible?.().then((visible) => {
      if (typeof visible === "boolean") setOverlayVisible(visible);
    });

    return window.overlay?.onOverlayVisibilityChanged?.((visible) => {
      setOverlayVisible(visible);
    });
  }, []);

  const toggleOverlay = async () => {
    const visible = await window.overlay?.setOverlayVisible?.(!overlayVisible);
    setOverlayVisible(visible ?? !overlayVisible);
  };

  const toggleStartup = async (enabled: boolean) => {
    setLaunchOnStartup(enabled);
    const confirmed = await window.overlay?.setLaunchOnStartup?.(enabled);
    if (typeof confirmed === "boolean") setLaunchOnStartup(confirmed);
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <div className="brand-lockup">
          <img
            className="brand-wordmark"
            src={signifyWordmarkUrl}
            alt="Signify"
          />
          <p>Accessibility control center</p>
        </div>
        <div className="topbar-actions">
          <span className="system-status">
            <span /> All systems ready
          </span>
          <button className="dashboard-action" onClick={toggleOverlay}>
            {overlayVisible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {overlayVisible ? "Hide overlay" : "Show overlay"}
          </button>
        </div>
      </header>
      <div className="dashboard-page__body">
        <div className="dashboard-intro">
          <div>
            <div className="eyebrow">Workspace settings</div>
            <h2>Your conversation, made visible.</h2>
            <p>
              Configure the overlay once, then keep the controls out of your way
              while you work.
            </p>
          </div>
          <img
            className="dashboard-hero-mark"
            src={signifyBrandmarkUrl}
            alt=""
          />
        </div>
        <div className="settings-layout">
          <section className="dashboard-card primary-card">
            <div className="card-heading">
              <div>
                <div className="eyebrow">Translation direction</div>
                <h3>Choose how you communicate</h3>
              </div>
              <Activity className="card-icon" />
            </div>
            <div className="dashboard-mode-grid">
              <button
                className={
                  settings.mode === "sign-to-words"
                    ? "dashboard-mode is-selected"
                    : "dashboard-mode"
                }
                onClick={() => updateSettings({ mode: "sign-to-words" })}
              >
                <Hand className="size-6" />
                <strong>Signs to words</strong>
                <span>
                  Recognize signing on your screen and turn it into captions.
                </span>
              </button>
              <button
                className={
                  settings.mode === "words-to-sign"
                    ? "dashboard-mode is-selected"
                    : "dashboard-mode"
                }
                onClick={() => updateSettings({ mode: "words-to-sign" })}
              >
                <Keyboard className="size-6" />
                <strong>Words to signs</strong>
                <span>Fingerspell typed words or shared computer audio.</span>
              </button>
            </div>
          </section>
          <section className="dashboard-card">
            <div className="eyebrow">Overlay appearance</div>
            <h3>Keep it readable</h3>
            <div className="setting-line">
              <div>
                <strong>Opacity</strong>
                <span>Adjust the overlay surface</span>
              </div>
              <span className="setting-value">{settings.opacity}%</span>
            </div>
            <Slider
              value={[settings.opacity]}
              min={42}
              max={90}
              step={1}
              onValueChange={([opacity]) => {
                if (typeof opacity === "number") updateSettings({ opacity });
              }}
              aria-label="Overlay opacity"
            />
          </section>
          <section className="dashboard-card">
            <div className="eyebrow">Output and startup</div>
            <h3>Personal preferences</h3>
            <div className="preference-line">
              <div className="preference-icon">
                <Volume2 className="size-4" />
              </div>
              <div>
                <strong>Spoken output</strong>
                <span>Read recognized signs aloud</span>
              </div>
              <Switch
                checked={settings.voiceOn}
                onCheckedChange={(voiceOn) => updateSettings({ voiceOn })}
                aria-label="Spoken output"
              />
            </div>
            <div className="preference-line">
              <div className="preference-icon">
                <Moon className="size-4" />
              </div>
              <div>
                <strong>Launch on startup</strong>
                <span>Open Sign Overlay when you sign in</span>
              </div>
              <Switch
                checked={launchOnStartup}
                onCheckedChange={toggleStartup}
                aria-label="Launch on startup"
              />
            </div>
          </section>
          <section className="dashboard-card status-card">
            <div className="eyebrow">Connected services</div>
            <h3>Gemini interpretation</h3>
            <div className="service-line">
              <Monitor className="size-4" />
              <span>Screen capture</span>
              <b>Ready</b>
            </div>
            <div className="service-line">
              <Activity className="size-4" />
              <span>Google Gemini Vision</span>
              <b>Ready</b>
            </div>
            <p>
              Recognition sends short screen-frame bursts to Gemini for ASL
              letter and phrase interpretation.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
