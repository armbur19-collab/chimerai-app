// @chimerai component=UseAppName version=1.0
'use client';

import { useState, useEffect } from 'react';

const DEFAULT_NAME = 'ChimerAI';

let cachedName: string | null = null;

export function useAppName() {
  const [appName, setAppName] = useState(cachedName || DEFAULT_NAME);

  useEffect(() => {
    if (cachedName) {
      setAppName(cachedName);
      return;
    }

    fetch('/api/app-settings')
      .then((res) => res.json())
      .then((data) => {
        const name = data.appName || DEFAULT_NAME;
        cachedName = name;
        setAppName(name);
      })
      .catch(() => {
        setAppName(DEFAULT_NAME);
      });
  }, []);

  return appName;
}
