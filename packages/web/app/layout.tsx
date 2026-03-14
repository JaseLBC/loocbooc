import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Loocbooc — Fashion Industry OS',
    template: '%s | Loocbooc',
  },
  description: 'The universal platform for fashion brands to digitise their garments and manage their catalogue.',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-text-primary antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
