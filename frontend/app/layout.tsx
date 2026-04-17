import Script from "next/script";
import type { Metadata } from "next";
import Providers from "./providers";
import Header from "@/components/Header";
import "./globals.css";

const GA_ID = "G-91M4529HE7";
const TOOL_NAME = "working-Americans-tax-cut-act-";

export const metadata: Metadata = {
  title: "Working Americans' Tax Cut Act Calculator | PolicyEngine",
  description:
    "Calculate your personal and national impact under the Working Americans' Tax Cut Act",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { tool_name: '${TOOL_NAME}' });
          `}
        </Script>
      </head>
      <body>
        <Header />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
