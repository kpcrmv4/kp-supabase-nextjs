'use client';
import { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ConfirmProvider } from '@/components/ui/confirm';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
          {children}
          <Toaster position="top-right" richColors />
        </ConfirmProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
