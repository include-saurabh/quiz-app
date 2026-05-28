import type { Metadata, Viewport } from 'next';
import { Mukta } from 'next/font/google';
import './globals.css';

const mukta = Mukta({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '600', '700'],
  variable: '--font-mukta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'मराठी AI क्विझ - सराव चाचणी',
  description: 'मराठीत सोपी आणि सुटसुटीत AI-संचलित सराव चाचणी. लॉगिनशिवाय थेट सराव सुरू करा.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mr" className={`${mukta.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
