import type { Metadata } from 'next';
import { Hero, Section, Bullets, Band } from '../../../../components/marketing/site';
import { WorksheetActions } from '../../../../components/marketing/WorksheetActions';

export const metadata: Metadata = {
  title: 'Can I Do This? — Permit-Path Worksheet',
  description:
    'A free, plain-language worksheet for figuring out the permit path before you spend time or money. Print it or download it.',
};

function Q({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-ink2 leading-relaxed mb-1">• {children}</p>;
}

const HANDLES: [string, string][] = [
  ['How land can be used / size / setbacks', 'Zoning / Planning office or Zoning Board'],
  ['Building, wiring, plumbing, structural', 'Building Department / Inspector'],
  ['Food, septic, water, animals', 'Board of Health'],
  ['Wetlands, water, protected land', 'Conservation Commission'],
  ['Running a business or event', 'Town Clerk / Licensing authority / Select Board'],
  ['Historic or special districts', 'Historic Commission / Planning'],
];

export default function CanIDoThis() {
  return (
    <>
      <Hero
        kicker="LogicCommons · free public worksheet"
        title="Can I Do This?"
        sub="A plain-language worksheet for figuring out the path before you spend time or money."
      />

      <div className="mb-6">
        <WorksheetActions />
      </div>

      <p className="max-w-2xl text-[14px] italic text-ink3 leading-relaxed mb-2">
        Fill this out before you call town hall. It won’t give you an answer — only the town can do
        that — but it will help you ask the right office the right question, and show up with the right
        information.
      </p>

      <Section title="1 · What are you trying to do?">
        <p className="text-[15px] text-ink2 leading-relaxed">
          Describe it in one or two plain sentences — for example, “put a shed in my backyard,” “open a
          small food business,” “add an apartment over my garage,” or “run an event on my property.”
        </p>
      </Section>

      <Section title="2 · Where would it happen?">
        <Bullets
          items={[
            'My own home / yard',
            'A property I rent or manage',
            'A commercial building or storefront',
            'Vacant land',
            'Public or shared space',
            'Not sure yet',
          ]}
        />
      </Section>

      <Section title="3 · Which systems might this touch? (any that might apply — guessing is fine)">
        <Bullets
          items={[
            <><strong className="text-ink">Zoning</strong> — is this use allowed here? Setbacks, size, how the land can be used.</>,
            <><strong className="text-ink">Building</strong> — is anything being built, changed, wired, or plumbed?</>,
            <><strong className="text-ink">Health</strong> — food, water, septic, animals, or anything affecting public health?</>,
            <><strong className="text-ink">Conservation</strong> — wetlands, water, slopes, trees, or protected land nearby?</>,
            <><strong className="text-ink">Licensing</strong> — does the activity itself need a license or permit to operate?</>,
            <><strong className="text-ink">Historic / other</strong> — historic district, special overlay, or something unusual?</>,
          ]}
        />
      </Section>

      <Section title="4 · The five questions to ask first">
        <Q>Is what I want to do allowed at this location at all?</Q>
        <Q>Which board or office handles it — and who do I talk to first?</Q>
        <Q>Do I need a permit, a variance, a special permit, a license — or nothing?</Q>
        <Q>What documents or drawings will I be asked to bring?</Q>
        <Q>Roughly how long does this usually take, and is there a public hearing?</Q>
      </Section>

      <Section title="5 · Who usually handles what (a starting guide — every town differs)">
        <div className="max-w-2xl overflow-hidden rounded-lg border border-bd">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="bg-s2 text-left text-ink2">
                <th className="px-4 py-2 font-medium">If it’s about…</th>
                <th className="px-4 py-2 font-medium">…start with</th>
              </tr>
            </thead>
            <tbody>
              {HANDLES.map(([a, b]) => (
                <tr key={a} className="border-t border-bd">
                  <td className="px-4 py-2 text-ink2">{a}</td>
                  <td className="px-4 py-2 font-medium text-g">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="6 · What to gather before you go">
        <Bullets
          items={[
            'Your address and parcel / lot number',
            'A simple sketch or photo of what you want to do',
            'Rough measurements (size, distance from property lines)',
            'Any past permits or plans you already have',
            'A short written description of the project',
          ]}
        />
      </Section>

      <Section title="When it’s worth getting help">
        <p className="max-w-2xl text-[15px] text-ink2 leading-relaxed mb-2">
          If your project touches several systems at once, involves a hearing, or you’ve already been
          bounced between offices, a <strong className="text-ink">Permit Path Scan</strong> ($250–$750)
          lays out the likely path, the boards involved, and the documents you’ll need — so you stop
          guessing. It doesn’t replace the town; it helps you move with confidence.
        </p>
        <Band>LogicCommons helps people start. PublicLogic helps them carry it through.</Band>
      </Section>

      <p className="max-w-2xl text-[12px] italic text-ink4 leading-relaxed border-t border-bd pt-4">
        This worksheet is a free public tool. It does not replace your municipality, inspector, planner,
        or permitting authority, and it is not legal advice. Always confirm with the office that has
        authority.
      </p>
    </>
  );
}
