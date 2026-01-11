import { useState, useEffect, useCallback } from "react";

interface GameState {
  bet: number;
  gameStarted: boolean;
  gameOver: boolean;
  currentMultiplier: number;
  [key: string]: any;
}

const STORAGE_KEY_PREFIX = "game_state_";

export function useGamePersistence<T extends GameState>(
  gameName: string,
  userId: string
) {
  const storageKey = `${STORAGE_KEY_PREFIX}${gameName}_${userId}`;

  const loadState = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if state is still valid (not older than 1 hour)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
          return parsed.state as T;
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch (e) {
      console.error("Error loading game state:", e);
    }
    return null;
  }, [storageKey]);

  const saveState = useCallback(
    (state: T) => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            state,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.error("Error saving game state:", e);
      }
    },
    [storageKey]
  );

  const clearState = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error("Error clearing game state:", e);
    }
  }, [storageKey]);

  return { loadState, saveState, clearState };
}
