// app/page.tsx

import Header from "@/components/header";
import Hero from "@/components/hero";
import Features from "@/components/features";
import Integrations from "@/components/integrations";
import Pricing from "@/components/pricing";
import Testimonials from "@/components/testimonials";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/footer";

export default function LandingPage() {
  return (
    <main className="bg-gray-900">
      <Header />
      <Hero />
      <Features />
      <Integrations />
      <Pricing />
      <Testimonials />
      <FAQ/>
      <CTA />
      <Footer />
    </main>
  );
}