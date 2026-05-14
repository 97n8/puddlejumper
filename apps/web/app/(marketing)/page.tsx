import { Hero } from "@/components/marketing/hero";
import { WhatIsGPR } from "@/components/marketing/what-is-gpr";
import { ProductSuite } from "@/components/marketing/product-suite";
import { Deployments } from "@/components/marketing/deployments";
import { CTA } from "@/components/marketing/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhatIsGPR />
      <ProductSuite />
      <Deployments />
      <CTA />
    </>
  );
}
