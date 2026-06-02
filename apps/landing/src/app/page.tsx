import { Suspense } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import PricingSection from '@/components/PricingSection';
import Footer from '@/components/Footer';
import { UtmCapture } from '@/components/UtmCapture';
import { TrackPageView } from '@/components/TrackPageView';

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <UtmCapture />
        <TrackPageView />
      </Suspense>
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
