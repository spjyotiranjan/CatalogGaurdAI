import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/LiveRegion";

export const metadata: Metadata = {
  title: "CatalogGuard AI",
  description: "Catalog validation, correction and review workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
