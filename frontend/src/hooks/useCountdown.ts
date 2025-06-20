import { useState, useEffect, useRef } from 'react';

interface UseCountdownOptions {
  initialTime: number; // in seconds
  interval?: number; // in milliseconds
  onComplete?: () => void;
}

export const useCountdown = ({ 
  initialTime, 
  interval = 1000, 
  onComplete 
}: UseCountdownOptions) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const reset = (newTime?: number) => {
    setTimeLeft(newTime ?? initialTime);
  };

  const start = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          onComplete?.();
          return 0; // Don't auto-reset, let parent handle it
        }
        return prevTime - 1;
      });
    }, interval);
  };

  const pause = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  };

  const stop = () => {
    pause();
    setTimeLeft(initialTime);
  };

  useEffect(() => {
    start();
    return () => pause();
  }, [initialTime, interval]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    timeLeft,
    isRunning,
    reset,
    start,
    pause,
    stop
  };
};