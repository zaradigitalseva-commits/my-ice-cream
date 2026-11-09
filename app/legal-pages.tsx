import Link from "next/link";

type Section = { heading: string; paragraphs: string[]; bullets?: string[] };

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return <main className="legal-shell">
    <header className="legal-top"><Link href="/" className="legal-brand">🍦 MY ICE CREAM</Link><Link href="/" className="legal-back">← Back to home</Link></header>
    <article className="legal-card">
      <p className="legal-eyebrow">MY ICE CREAM · INFORMATION</p><h1>{title}</h1><p className="legal-intro">{intro}</p>
      {sections.map((section) => <section className="legal-section" key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((p, i) => <p key={i}>{p}</p>)}{section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}
      <p className="legal-updated">Last updated: 9 November 2026</p>
    </article>
    <footer className="legal-bottom"><Link href="/about">About</Link><Link href="/privacy-policy">Privacy</Link><Link href="/contact">Contact</Link><Link href="/terms">Terms</Link><Link href="/disclaimer">Disclaimer</Link><Link href="/cookie-policy">Cookies</Link></footer>
  </main>;
}
