'use client';

import 'sonner/dist/styles.css';

import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';

export function SonnerToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Toaster
      position="bottom-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      richColors
      closeButton
      toastOptions={{ duration: 3200 }}
    />
  );
}
