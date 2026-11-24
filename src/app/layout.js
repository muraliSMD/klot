import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: "K-LOT | Kerala Lottery Last-Digit Analysis",
  description: "Last-digit pattern analysis for Kerala Lottery, validated against every stored draw.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${outfit.variable} antialiased bg-background text-foreground font-sans bg-gradient-mesh min-h-screen`}
        suppressHydrationWarning
      >
        <div className="relative z-10">
          {children}
        </div>
        <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0"></div>
      </body>
    </html>
  );
}
