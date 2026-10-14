import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotiHack",
  description:
    "Get an email the moment hackathon registrations open. Hackathons on a globe, rated for Fun, Career and Learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
