import { lazy, Suspense, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PageSkeleton } from '@/components/layout/PageSkeleton';

// Eager-loaded (small, critical path)
import Auth from '@/pages/Auth';
import Landing from '@/pages/Landing';
import Index from '@/pages/Index';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';
import ResetPassword from '@/pages/ResetPassword';

// Lazy-loaded (heavy pages)
const Wardrobe = lazy(() => import('@/pages/Wardrobe'));
const AddGarment = lazy(() => import('@/pages/AddGarment'));
const GarmentDetail = lazy(() => import('@/pages/GarmentDetail'));
const EditGarment = lazy(() => import('@/pages/EditGarment'));
const Outfits = lazy(() => import('@/pages/Outfits'));
const OutfitDetail = lazy(() => import('@/pages/OutfitDetail'));
const OutfitGenerate = lazy(() => import('@/pages/OutfitGenerate'));
const Plan = lazy(() => import('@/pages/Plan'));
const AIChat = lazy(() => import('@/pages/AIChat'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Insights = lazy(() => import('@/pages/Insights'));
const Settings = lazy(() => import('@/pages/Settings'));
const SettingsAppearance = lazy(() => import('@/pages/settings/SettingsAppearance'));
const SettingsStyle = lazy(() => import('@/pages/settings/SettingsStyle'));
const SettingsNotifications = lazy(() => import('@/pages/settings/SettingsNotifications'));
const SettingsAccount = lazy(() => import('@/pages/settings/SettingsAccount'));
const SettingsPrivacy = lazy(() => import('@/pages/settings/SettingsPrivacy'));
const GenerateImages = lazy(() => import('@/pages/settings/GenerateImages'));
const SeedWardrobe = lazy(() => import('@/pages/settings/SeedWardrobe'));
const ShareOutfit = lazy(() => import('@/pages/ShareOutfit'));
const BillingSuccess = lazy(() => import('@/pages/BillingSuccess'));
const BillingCancel = lazy(() => import('@/pages/BillingCancel'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const LiveScan = lazy(() => import('@/pages/LiveScan'));
const TravelCapsule = lazy(() => import('@/pages/TravelCapsule'));
const GoogleCalendarCallback = lazy(() => import('@/pages/GoogleCalendarCallback'));
const PrivacyPolicy = lazy(() => import('@/pages/marketing/PrivacyPolicy'));
const Terms = lazy(() => import('@/pages/marketing/Terms'));
const Contact = lazy(() => import('@/pages/marketing/Contact'));
const Admin = lazy(() => import('@/pages/marketing/Admin'));
const PublicProfile = lazy(() => import('@/pages/PublicProfile'));
const InspirationFeed = lazy(() => import('@/pages/InspirationFeed'));
const StyleChallenges = lazy(() => import('@/pages/StyleChallenges'));
const VisualSearch = lazy(() => import('@/pages/VisualSearch'));
const MoodOutfit = lazy(() => import('@/pages/MoodOutfit'));
const SmartShopping = lazy(() => import('@/pages/SmartShopping'));
const WardrobeAging = lazy(() => import('@/pages/WardrobeAging'));
const StyleTwin = lazy(() => import('@/pages/StyleTwin'));
const Discover = lazy(() => import('@/pages/Discover'));
const PickMustHaves = lazy(() => import('@/pages/PickMustHaves'));

const routeTransition = {
  type: 'tween' as const,
  ease: EASE_CURVE,
  duration: 0.2,
};

const routeVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

// Smoother crossfade for dark-to-dark page transitions (landing ↔ auth)
const darkRoutes = new Set(['/welcome', '/auth']);
const crossfadeTransition = {
  type: 'tween' as const,
  ease: EASE_CURVE,
  duration: 0.2,
};
const crossfadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export function AnimatedRoutes() {
  const location = useLocation();
  const isFirstRender = useRef(true);
  const isDark = darkRoutes.has(location.pathname);
  const variants = isDark ? crossfadeVariants : routeVariants;
  const transition = isDark ? crossfadeTransition : routeTransition;

  // Skip animation on very first render so the page appears instantly
  const skipInitial = isFirstRender.current;
  if (isFirstRender.current) isFirstRender.current = false;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="min-h-[100dvh] bg-background"
        variants={variants}
        initial={skipInitial ? false : "initial"}
        animate="animate"
        exit="exit"
        transition={transition}
      >
        <Suspense fallback={<PageSkeleton />}>
          <Routes location={location}>
            {/* Legal & admin */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin" element={<Admin />} />

            {/* App routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/welcome" element={<Landing />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<ProtectedRoute skipOnboardingCheck><Onboarding /></ProtectedRoute>} />
            <Route path="/" element={<Index />} />
            <Route path="/wardrobe" element={<ProtectedRoute><Wardrobe /></ProtectedRoute>} />
            <Route path="/wardrobe/add" element={<ProtectedRoute><AddGarment /></ProtectedRoute>} />
            <Route path="/wardrobe/scan" element={<ProtectedRoute><LiveScan /></ProtectedRoute>} />
            <Route path="/wardrobe/:id" element={<ProtectedRoute><GarmentDetail /></ProtectedRoute>} />
            <Route path="/wardrobe/:id/edit" element={<ProtectedRoute><EditGarment /></ProtectedRoute>} />
            <Route path="/outfits" element={<ProtectedRoute><Outfits /></ProtectedRoute>} />
            <Route path="/outfits/generate" element={<ProtectedRoute><OutfitGenerate /></ProtectedRoute>} />
            <Route path="/outfits/:id" element={<ProtectedRoute><OutfitDetail /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
            <Route path="/plan/travel-capsule" element={<ProtectedRoute><TravelCapsule /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
            <Route path="/ai" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/appearance" element={<ProtectedRoute><SettingsAppearance /></ProtectedRoute>} />
            <Route path="/settings/style" element={<ProtectedRoute><SettingsStyle /></ProtectedRoute>} />
            <Route path="/settings/notifications" element={<ProtectedRoute><SettingsNotifications /></ProtectedRoute>} />
            <Route path="/settings/account" element={<ProtectedRoute><SettingsAccount /></ProtectedRoute>} />
            <Route path="/settings/privacy" element={<ProtectedRoute><SettingsPrivacy /></ProtectedRoute>} />
            <Route path="/settings/generate-images" element={<ProtectedRoute><GenerateImages /></ProtectedRoute>} />
            <Route path="/settings/seed-wardrobe" element={<ProtectedRoute><SeedWardrobe /></ProtectedRoute>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/billing/success" element={<ProtectedRoute><BillingSuccess /></ProtectedRoute>} />
            <Route path="/billing/cancel" element={<ProtectedRoute><BillingCancel /></ProtectedRoute>} />
            <Route path="/share/:id" element={<ShareOutfit />} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/feed" element={<ProtectedRoute><InspirationFeed /></ProtectedRoute>} />
            <Route path="/challenges" element={<ProtectedRoute><StyleChallenges /></ProtectedRoute>} />
            <Route path="/ai/visual-search" element={<ProtectedRoute><VisualSearch /></ProtectedRoute>} />
            <Route path="/ai/mood-outfit" element={<ProtectedRoute><MoodOutfit /></ProtectedRoute>} />
            <Route path="/ai/smart-shopping" element={<ProtectedRoute><SmartShopping /></ProtectedRoute>} />
            <Route path="/ai/wardrobe-aging" element={<ProtectedRoute><WardrobeAging /></ProtectedRoute>} />
            <Route path="/ai/style-twin" element={<ProtectedRoute><StyleTwin /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
            <Route path="/calendar/callback" element={<ProtectedRoute><GoogleCalendarCallback /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
