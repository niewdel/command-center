import type { Metadata } from "next";
import Image from "next/image";
import { Montserrat, Inter } from "next/font/google";

// Brand v3 type system: Montserrat for structure, Inter for reading.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Niewdel — Coming soon",
  description: "Niewdel's custom app is coming soon. We build what you can't imagine yet.",
};

export default function ComingSoon() {
  return (
    <div className={`${montserrat.variable} ${inter.variable} ns-root`}>
      {/* Oversized ghost mark, echoing the brand cover. Decorative only. */}
      <Image
        src="/logos/niewdel-icon.png"
        alt=""
        aria-hidden
        width={1200}
        height={1200}
        className="ns-ghost"
        priority
      />

      <main className="ns-stage">
        <Image
          src="/logos/niewdel-wordmark.png"
          alt="Niewdel"
          width={880}
          height={186}
          className="ns-wordmark"
          priority
        />

        <p className="ns-eyebrow">Under construction</p>

        <h1 className="ns-headline">
          Niewdel&rsquo;s custom app is coming soon<span className="ns-dot" aria-hidden>.</span>
        </h1>

        <p className="ns-sub">
          We&rsquo;re rebuilding it from the ground up. Check back soon for
          something built for how your business runs.
        </p>

        <a className="ns-cta" href="https://niewdel.com">
          Go to niewdel.com <span aria-hidden>&rarr;</span>
        </a>
      </main>

      <footer className="ns-footer">
        <span>Charlotte, NC</span>
        <span className="ns-tagline">
          &ldquo;We build what you can&rsquo;t imagine yet.&rdquo;
        </span>
      </footer>

      {/* Self-contained brand styling. Jet Black surface, Niewdel Blue accent,
          deliberately independent of the legacy app design tokens. */}
      <style>{`
        .ns-root {
          --jet: #0D0D0D;
          --onyx: #1A1A1A;
          --blue: #3B86DB;
          --navy: #1B4D8F;
          --cloud: #F5F5F5;
          --muted: #9AA3A8;
          --faint: #5C666D;
          position: fixed;
          inset: 0;
          overflow: hidden;
          background: var(--jet);
          color: var(--cloud);
          font-family: var(--font-inter), system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          padding: clamp(24px, 5vw, 64px);
        }
        .ns-ghost {
          position: absolute;
          right: -12%;
          bottom: -18%;
          width: clamp(420px, 60vw, 900px);
          height: auto;
          opacity: 0.04;
          pointer-events: none;
          user-select: none;
        }
        .ns-stage {
          position: relative;
          z-index: 1;
          margin: auto 0;
          max-width: 760px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .ns-wordmark {
          width: clamp(150px, 22vw, 210px);
          height: auto;
        }
        .ns-eyebrow {
          margin: clamp(40px, 7vh, 72px) 0 0;
          font-family: var(--font-montserrat), system-ui, sans-serif;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--blue);
        }
        .ns-headline {
          margin: 16px 0 0;
          font-family: var(--font-montserrat), system-ui, sans-serif;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          font-size: clamp(2rem, 6vw, 3.25rem);
          text-wrap: balance;
        }
        .ns-dot { color: var(--blue); }
        .ns-sub {
          margin: 20px 0 0;
          max-width: 48ch;
          font-size: clamp(1rem, 2.2vw, 1.125rem);
          line-height: 1.5;
          color: var(--muted);
          text-wrap: pretty;
        }
        .ns-cta {
          margin-top: clamp(28px, 5vh, 40px);
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 26px;
          border-radius: 40px;
          background: var(--blue);
          color: #fff;
          font-family: var(--font-montserrat), system-ui, sans-serif;
          font-weight: 700;
          font-size: 15px;
          text-decoration: none;
          transition: background-color 150ms ease;
        }
        .ns-cta:hover { background: var(--navy); }
        .ns-cta:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 3px;
        }
        .ns-footer {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 20px;
          justify-content: space-between;
          padding-top: 24px;
          border-top: 1px solid #262B2E;
          font-size: 12px;
          color: var(--faint);
        }
        .ns-tagline { font-style: italic; }
      `}</style>
    </div>
  );
}
