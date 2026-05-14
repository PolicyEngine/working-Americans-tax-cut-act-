import { PolicyEngineShell } from "@policyengine/ui-kit/layout";
import "@policyengine/ui-kit/styles.css";

import Script from "next/script";
import type { Metadata } from "next";
import Providers from "./providers";
import Header from "@/components/Header";
import "./globals.css";

const GA_ID = "G-2YHG89FY0N";
const TOOL_NAME = "working-Americans-tax-cut-act-";

const SITE_URL = "https://policyengine.org/us/watca";
const OG_IMAGE_URL =
  "https://raw.githubusercontent.com/PolicyEngine/policyengine-app-v2/main/app/public/assets/logos/policyengine/logo.png";

export const metadata: Metadata = {
  title: "Working Americans' Tax Cut Act Calculator | PolicyEngine",
  description:
    "Calculate your personal and national impact under the Working Americans' Tax Cut Act. Estimate the cost-of-living exemption and millionaire surtax effects on your household.",
  keywords: [
    "Working Americans Tax Cut Act",
    "WATCA",
    "tax calculator",
    "cost-of-living exemption",
    "millionaire surtax",
    "PolicyEngine",
    "tax reform",
    "income tax",
    "household impact",
    "national impact",
  ],
  authors: [{ name: "PolicyEngine", url: "https://policyengine.org" }],
  creator: "PolicyEngine",
  publisher: "PolicyEngine",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Working Americans' Tax Cut Act Calculator | PolicyEngine",
    description:
      "Calculate your personal and national impact under the Working Americans' Tax Cut Act. Estimate the cost-of-living exemption and millionaire surtax effects on your household.",
    url: SITE_URL,
    siteName: "PolicyEngine",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "PolicyEngine - Working Americans' Tax Cut Act Calculator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Working Americans' Tax Cut Act Calculator | PolicyEngine",
    description:
      "Calculate your personal and national impact under the Working Americans' Tax Cut Act.",
    images: [OG_IMAGE_URL],
    creator: "@ThePolicyEngine",
    site: "@ThePolicyEngine",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "theme-color": "#2C7A7B",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Working Americans' Tax Cut Act Calculator",
    description:
      "Calculate your personal and national impact under the Working Americans' Tax Cut Act. Estimate the cost-of-living exemption and millionaire surtax effects on your household.",
    url: SITE_URL,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "PolicyEngine",
      url: "https://policyengine.org",
      logo: OG_IMAGE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "PolicyEngine",
      url: "https://policyengine.org",
    },
  };

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="https://policyengine.org/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="https://policyengine.org/favicon.ico" />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
        <Script id="engagement-tracking" strategy="afterInteractive">
          {`
            (function() {
              var TOOL_NAME = '${TOOL_NAME}';
              if (typeof window === 'undefined' || !window.gtag) return;

              var scrollFired = {};
              window.addEventListener('scroll', function() {
                var docHeight = document.documentElement.scrollHeight - window.innerHeight;
                if (docHeight <= 0) return;
                var pct = Math.floor((window.scrollY / docHeight) * 100);
                [25, 50, 75, 100].forEach(function(m) {
                  if (pct >= m && !scrollFired[m]) {
                    scrollFired[m] = true;
                    window.gtag('event', 'scroll_depth', { percent: m, tool_name: TOOL_NAME });
                  }
                });
              }, { passive: true });

              [30, 60, 120, 300].forEach(function(sec) {
                setTimeout(function() {
                  if (document.visibilityState !== 'hidden') {
                    window.gtag('event', 'time_on_tool', { seconds: sec, tool_name: TOOL_NAME });
                  }
                }, sec * 1000);
              });

              document.addEventListener('click', function(e) {
                var link = e.target && e.target.closest ? e.target.closest('a') : null;
                if (!link || !link.href) return;
                try {
                  var url = new URL(link.href, window.location.origin);
                  if (url.hostname && url.hostname !== window.location.hostname) {
                    window.gtag('event', 'outbound_click', {
                      url: link.href,
                      target_hostname: url.hostname,
                      tool_name: TOOL_NAME
                    });
                  }
                } catch (err) {}
              });
            })();
          `}
        </Script>
      </head>
      <body>
        <PolicyEngineShell country="us">
        <Header />
        <Providers>{children}</Providers>
              </PolicyEngineShell>
      </body>
    </html>
  );
}
