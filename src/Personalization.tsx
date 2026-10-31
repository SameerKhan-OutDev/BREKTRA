import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";

export type Appearance = "light" | "dark" | "system";
const storageKey = "brektra.appearance";
const validAppearance = (value: string | null): Appearance => value === "dark" || value === "system" ? value : "light";
const readAppearance = (): Appearance => {
  try { return validAppearance(localStorage.getItem(storageKey)); } catch { return "light"; }
};
function applyAppearance(value: Appearance) {
  document.documentElement.dataset.theme = value === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value;
}
// Apply before the first React render, including the access and loading screens.
applyAppearance(readAppearance());
const AppearanceContext = createContext({ appearance: "light" as Appearance, saved: true, setAppearance: (_value: Appearance) => {} });

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, updateAppearance] = useState(readAppearance);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    applyAppearance(appearance);
    const device = matchMedia("(prefers-color-scheme: dark)");
    const change = () => { if (appearance === "system") applyAppearance("system"); };
    device.addEventListener("change", change);
    return () => device.removeEventListener("change", change);
  }, [appearance]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) {
        const next = readAppearance(); applyAppearance(next); updateAppearance(next); setSaved(true);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const setAppearance = (value: Appearance) => {
    applyAppearance(value); updateAppearance(value);
    try { localStorage.setItem(storageKey, value); setSaved(true); } catch { setSaved(false); }
  };
  return <AppearanceContext.Provider value={{ appearance, saved, setAppearance }}>{children}</AppearanceContext.Provider>;
}

export function AccessAppearance() {
  const { appearance, saved, setAppearance } = useContext(AppearanceContext);
  const dark = appearance === "dark" || (appearance === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  return <div className="access-appearance"><button type="button" className="text-button" role="switch" aria-checked={dark}
    aria-label="Obsidian Mint dark mode" onClick={() => setAppearance(dark ? "light" : "dark")}>
    {dark ? <Moon size={17}/> : <Sun size={17}/>}<span>{dark ? "Obsidian Mint" : "Light mode"}</span><i aria-hidden="true"/>
  </button>{!saved && <small role="status">Applied for this visit. Browser storage is unavailable.</small>}</div>;
}

export function Personalization() {
  const { appearance, saved, setAppearance } = useContext(AppearanceContext);
  return <section className="panel personalization" aria-labelledby="personalization-title">
    <div className="panel-header"><div><h2 id="personalization-title">Personalization</h2><p>Choose how BREKTRA looks on this browser.</p></div><span className="badge green">Obsidian Mint</span></div>
    <fieldset className="appearance-options"><legend>Appearance</legend>
      {([{ value: "light", title: "Light", detail: "Obsidian Mint in daylight", icon: Sun },
        { value: "dark", title: "Dark", detail: "Obsidian Mint", icon: Moon },
        { value: "system", title: "Use device setting", detail: "Follow your device appearance", icon: Monitor }] as const).map(({ value, title, detail, icon: Icon }) =>
        <label className={`appearance-option ${appearance === value ? "selected" : ""}`} key={value}>
          <input type="radio" name="appearance" value={value} checked={appearance === value} onChange={() => setAppearance(value)} />
          <Icon size={20} /><span><strong>{title}</strong><small>{detail}</small></span>{appearance === value && <Check size={17} aria-hidden="true" />}
        </label>)}
    </fieldset>
    <div className="appearance-footer"><span className="palette-swatches" aria-hidden="true"><i/><i/><i/><i/></span><p role="status">{saved ? "Your preference is saved on this browser." : "Applied for this visit. Browser storage is unavailable."}</p></div>
  </section>;
}
