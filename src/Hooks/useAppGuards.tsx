import { useState } from 'react';

// iOS has no Android back button. Navigation remains in the original page controls.
export const usePWAProtection = (): void => {};
export const useDevtoolsBlocker = (): void => {};
export const useBackButtonExit = () => {
  const [exit, setExit] = useState({
    alert: false,
    message: '',
    confirm: false,
    id: ''
  });
  return {
    exit,
    setExit,
    confirmExit: () => setExit(value => ({
      ...value,
      alert: false
    }))
  };
};
