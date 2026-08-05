import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "BCP - Clinic Management System",
  description: "Your way for better wellness",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body className="min-h-full flex flex-col">
        <NextTopLoader
          color="#0f6647"
          height={5}
          showSpinner={false}
          crawl
          easing="ease"
          speed={250}
          shadow="none"
        />

        {children}

        <Toaster />
      </body>
    </html>
  )
}
