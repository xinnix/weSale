import { Suspense } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import SocialProofSection from '@/components/SocialProofSection';
import FeaturesSection from '@/components/FeaturesSection';
import PricingSection from '@/components/PricingSection';
import CtaBanner from '@/components/CtaBanner';
import Footer from '@/components/Footer';
import FloatingCTA from '@/components/FloatingCTA';
import { UtmCapture } from '@/components/UtmCapture';

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <UtmCapture />
      </Suspense>
      <Header />
      <main>
        <HeroSection />
        <SocialProofSection />
        <FeaturesSection />
        <PricingSection />
        <CtaBanner />
      </main>
      <Footer />
      <FloatingCTA />
    </>
  );
}
