import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ASDC Attendance',
  description: 'Smart, secure institute attendance and student management system for ASDC with classroom QR scanning, verified batch tracking, and real-time administrative reporting.',
  openGraph: {
    title: 'ASDC Attendance',
    description: 'Smart, secure institute attendance and student management system for ASDC with classroom QR scanning, verified batch tracking, and real-time administrative reporting.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ASDC Attendance',
    description: 'Smart, secure institute attendance and student management system for ASDC with classroom QR scanning, verified batch tracking, and real-time administrative reporting.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="bg-white text-slate-900 antialiased min-h-screen selection:bg-blue-600 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
