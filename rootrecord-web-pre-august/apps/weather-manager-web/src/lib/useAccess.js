import { useEffect, useState } from 'react';
import { session } from './api';

export function getAccess() {
  return { pro: session.isPro(), life: session.isLifeMember() };
}

export default function useAccess() {
  const [access, setAccess] = useState(getAccess());

  useEffect(() => {
    const on = () => setAccess(getAccess());
    window.addEventListener(session.ACCESS_EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(session.ACCESS_EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);

  return access;
}

