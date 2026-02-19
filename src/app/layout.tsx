import type { Metadata } from "next";

import "./globals.css";
import "@copilotkit/react-ui/styles.css";

export const metadata: Metadata = {
  title: "CopilotKit Thread Switching Demo",
  description:
    "Thread switching with CopilotKit, LangGraph Python, FastAPI, and shared state",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={"antialiased"}>{children}</body>
    </html>
  );
}
