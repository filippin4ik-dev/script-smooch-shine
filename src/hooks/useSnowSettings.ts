import { useState, useEffect } from "react";

const SNOW_ENABLED_KEY = "casino_snow_enabled";

export const useSnowSettings = () => {
  const [isSnowEnabled, setIsSnowEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(SNOW_ENABLED_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(SNOW_ENABLED_KEY, String(isSnowEnabled));
  }, [isSnowEnabled]);

  const toggleSnow = () => {
    setIsSnowEnabled((prev) => !prev);
  };

  return { isSnowEnabled, toggleSnow, setIsSnowEnabled };
};
