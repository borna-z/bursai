import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
const ShareOutfit = lazy(() => import('@/pages/ShareOutfit'));
const BillingSuccess = lazy(() => import('@/pages/BillingSuccess'));
const BillingCancel = lazy(() => import('@/pages/BillingCancel'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const LiveScan = lazy(() => import('@/pages/LiveScan'));
const GoogleCalendarCallback = lazy(() => import('@/pages/GoogleCalendarCallback'));
const PrivacyPolicy = lazy(() => import('@/pages/marketing/PrivacyPolicy'));
const Terms = lazy(() => import('@/pages/marketing/Terms'));
const Contact = lazy(() => import('@/pages/marketing/Contact'));
const Admin = lazy(() => import('@/pages/marketing/Admin'));

const routeTransition = {
  type: 'tween' as const,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
  duration: 0.25,
};

const routeVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={routeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={routeTransition}
        style={{ minHeight: '100dvh' }}
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
            <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
            <Route path="/ai" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/appearance" element={<ProtectedRoute><SettingsAppearance /></ProtectedRoute>} />
            <Route path="/settings/style" element={<ProtectedRoute><SettingsStyle /></ProtectedRoute>} />
            <Route path="/settings/notifications" element={<ProtectedRoute><SettingsNotifications /></ProtectedRoute>} />
            <Route path="/settings/account" element={<ProtectedRoute><SettingsAccount /></ProtectedRoute>} />
            <Route path="/settings/privacy" element={<ProtectedRoute><SettingsPrivacy /></ProtectedRoute>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/billing/success" element={<ProtectedRoute><BillingSuccess /></ProtectedRoute>} />
            <Route path="/billing/cancel" element={<ProtectedRoute><BillingCancel /></ProtectedRoute>} />
            <Route path="/share/:id" element={<ShareOutfit />} />
            <Route path="/calendar/callback" element={<ProtectedRoute><GoogleCalendarCallback /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
