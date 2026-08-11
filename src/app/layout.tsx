import { Fraunces, Source_Sans_3 } from "next/font/google";
import type { Metadata } from "next";
import { AppNav } from "@/components/ui/AppNav";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Plately",
    template: "%s · Plately",
  },
  description: "Personal meal planning for the week or fortnight",
  icons: {
    icon: "/plately-mark.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className={`${fraunces.variable} ${sourceSans.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">
        <AppNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
