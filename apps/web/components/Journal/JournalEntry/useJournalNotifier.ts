import { useCallback, useEffect, useRef, useState } from 'react';

export function useJournalNotifier() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const successTimerRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearSuccessTimer = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  };

  const clearErrorTimer = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  };

  const showMessage = useCallback((message: string, isError: boolean = false) => {
    if (isError) {
      clearErrorTimer();
      setErrorMessage(message);
      errorTimerRef.current = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return;
    }

    clearSuccessTimer();
    setSuccessMessage(message);
    successTimerRef.current = setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      clearSuccessTimer();
      clearErrorTimer();
    };
  }, []);

  return {
    successMessage,
    errorMessage,
    showMessage,
  };
}
