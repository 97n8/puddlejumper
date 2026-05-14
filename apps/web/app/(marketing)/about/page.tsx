import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About PublicLogic",
  description:
    "PublicLogic builds PuddleJumper, the first governance process runtime. Founded by Nathan Boudreau and Dr. Allison Weiss Rothschild.",
};

export default function AboutPage() {
  return (
    <article>
      <section className="max-w-3xl mx-auto px-6 py-24">
        <p className="text-xs font-mono tracking-widest text-[var(--pj-gold)] mb-3">// ABOUT</p>
        <h1 className="text-5xl leading-tight mb-8">PublicLogic</h1>

        <div className="prose-lg space-y-6 text-[var(--text-muted)] leading-relaxed">
          <p className="text-xl text-[var(--text-primary)] font-medium">
            We ask people to carry loads the structure should carry.
            Then we blame them when they drop it.
          </p>

          <p>
            Nathan Boudreau spent fifteen years in local government — as a Gardner City Councillor,
            as Town Administrator in Hubbardston, in every room where budgets get tight and staff
            leaves and state mandates arrive without the resources to implement them. He has an MPA
            and a MCPPO. He wrote the VAULT framework on paper before he had the language to know
            what it was.
          </p>

          <p>
            Dr. Allison Weiss Rothschild is an organizational psychologist. She sees the behavioral
            fault lines that practitioners walk right past. Nate wrote the doctrine. Allison turned
            it into something that actually changes how people work.
          </p>

          <p>
            Together they built PuddleJumper — the first governance process runtime. A layer that
            sits between a decision and an action, evaluates authority, routes to the right person,
            and produces an audit trail that can&apos;t be altered. SQLite triggers enforce it.
            You can&apos;t bypass the record. It&apos;s not a feature. It&apos;s the environment.
          </p>

          <blockquote className="border-l-4 border-[var(--pj-gold)] pl-6 py-2 my-8 text-[var(--text-primary)] italic text-xl">
            &ldquo;I wanted to be the person who fixes the invisible machinery — not the trucks
            and pipes and roads, but the rules about who can approve what, the process that
            determines whether the thing you need actually reaches the person who can do
            something about it.&rdquo;
            <footer className="text-sm font-mono not-italic mt-3 text-[var(--text-muted)]">
              — Nathan Boudreau, founder
            </footer>
          </blockquote>

          <p>
            PuddleJumper is live in Phillipston, Sutton, and Westminster, MA on Community Compact
            IT grants. It&apos;s running NMTC compliance for a $10M+ biochar deal. Nate wrote the
            code. He wrote the grant applications. He&apos;s also running for State Representative
            in the 2nd Worcester District — Gardner, Ashburnham, Templeton, Winchendon — because
            some problems need someone in the room where the law gets made who has actually sat
            in the chair where the law gets applied.
          </p>
        </div>
      </section>

      <section className="bg-[var(--surface-elevated)] py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl mb-8">The Team</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: "Nathan Boudreau",
                title: "Co-founder & CEO",
                bio: "MPA · MCPPO · Gardner City Councillor (5 terms) · Town Administrator, Hubbardston · 2nd Worcester District State Rep candidate. Built PuddleJumper from the ground up.",
              },
              {
                name: "Dr. Allison Weiss Rothschild",
                title: "Co-founder & COO",
                bio: "PsyD · Organizational psychologist. Turns governance doctrine into systems that actually change how people work. The behavioral science behind VAULT.",
              },
            ].map((p) => (
              <div key={p.name} className="space-y-2">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <p className="text-xs font-mono text-[var(--pj-gold)]">{p.title}</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{p.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl mb-4">Get in touch</h2>
          <p className="text-[var(--text-muted)] mb-6">
            PublicLogic LLC · Gardner, MA
          </p>
          <Link
            href="/contact"
            className="rounded-md bg-[var(--pj-navy)] px-6 py-3 text-white font-medium inline-block"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </article>
  );
}
