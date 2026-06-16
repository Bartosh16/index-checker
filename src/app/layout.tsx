import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Index Checker",
  description: "Batch index visibility checker for owned domains."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
