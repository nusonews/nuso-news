import "./globals.css";

export const metadata = {
  title: "FlexRoute | Advanced Redirect & Analytics Engine",
  description: "Secure, cloaked URL routing with real-time deep links, rotation, and social preview optimization.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
