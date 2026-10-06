import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { QueryProvider } from '@/lib/query-provider';

export const metadata: Metadata = {
  title: 'HomeExpense — Household Financial Operating System',
  description: 'Deterministic household ledger, split management, and balance settlement',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
