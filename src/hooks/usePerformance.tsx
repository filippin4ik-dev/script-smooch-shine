import { useState, useEffect, createContext, useContext } from "react";

interface PerformanceSettings {
  reducedMotion: boolean;
  disableOrbs: boolean;
  disableParticles: boolean;
  lowQualityImages: boolean;
}

interface PerformanceContextType {
  settings: PerformanceSettings;
  isLowPerformanceMode: boolean;
  toggleLowPerformanceMode: () => void;
  updateSetting: <K extends keyof PerformanceSettings>(key: K, value: PerformanceSettings[K]) => void;
}

const defaultSettings: PerformanceSettings = {
  reducedMotion: false,
  disableOrbs: false,
  disableParticles: false,
  lowQualityImages: false,
};

const PerformanceContext = createContext<PerformanceContextType | null>(null);

export const PerformanceProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<PerformanceSettings>(() => {
    const stored = localStorage.getItem("performance-settings");
    if (stored) {
      try {
        return { ...defaultSettings, ...JSON.parse(stored) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const isLowPerformanceMode = settings.reducedMotion && settings.disableOrbs && settings.disableParticles;

  useEffect(() => {
    localStorage.setItem("performance-settings", JSON.stringify(settings));
    
    // Apply reduced motion to document
    if (settings.reducedMotion) {
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
    }
  }, [settings]);

  const toggleLowPerformanceMode = () => {
    const newLowMode = !isLowPerformanceMode;
    setSettings({
      reducedMotion: newLowMode,
      disableOrbs: newLowMode,
      disableParticles: newLowMode,
      lowQualityImages: newLowMode,
    });
  };

  const updateSetting = <K extends keyof PerformanceSettings>(key: K, value: PerformanceSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <PerformanceContext.Provider value={{ settings, isLowPerformanceMode, toggleLowPerformanceMode, updateSetting }}>
      {children}
    </PerformanceContext.Provider>
  );
};

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error("usePerformance must be used within PerformanceProvider");
  }
  return context;
};
