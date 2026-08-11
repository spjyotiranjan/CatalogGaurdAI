import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CatalogGuard AI",
  description: "Catalog validation and review workspace",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
