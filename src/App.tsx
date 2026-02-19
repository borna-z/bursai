 import { Toaster } from "@/components/ui/toaster";
 import { Toaster as Sonner } from "@/components/ui/sonner";
 import { TooltipProvider } from "@/components/ui/tooltip";
 import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
 import { BrowserRouter, Routes, Route } from "react-router-dom";
 import { HelmetProvider } from "react-helmet-async";
 import { AuthProvider } from "@/contexts/AuthContext";
 import { ThemeProvider } from "@/contexts/ThemeContext";
 import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
 import Auth from "./pages/Auth";
 import Home from "./pages/Home";
 import Wardrobe from "./pages/Wardrobe";
 import AddGarment from "./pages/AddGarment";
 import GarmentDetail from "./pages/GarmentDetail";
import Outfits from "./pages/Outfits";
import OutfitDetail from "./pages/OutfitDetail";
import OutfitGenerate from "./pages/OutfitGenerate";
import Plan from "./pages/Plan";
import AIChat from "./pages/AIChat";
import Onboarding from "./pages/Onboarding";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import ShareOutfit from "./pages/ShareOutfit";
import BillingSuccess from "./pages/BillingSuccess";
import BillingCancel from "./pages/BillingCancel";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import LiveScan from "./pages/LiveScan";
 // Marketing pages
 import MarketingHome from "./pages/marketing/MarketingHome";
 import PrivacyPolicy from "./pages/marketing/PrivacyPolicy";
 import Terms from "./pages/marketing/Terms";
 import Contact from "./pages/marketing/Contact";
 import Admin from "./pages/marketing/Admin";

const queryClient = new QueryClient();

 const App = () => (
   <HelmetProvider>
     <QueryClientProvider client={queryClient}>
       <ThemeProvider>
         <AuthProvider>
           <TooltipProvider>
             <Toaster />
             <Sonner />
             <BrowserRouter>
               <Routes>
                 {/* Marketing site */}
                 <Route path="/marketing" element={<MarketingHome />} />
                 <Route path="/privacy" element={<PrivacyPolicy />} />
                 <Route path="/terms" element={<Terms />} />
                 <Route path="/contact" element={<Contact />} />
                 <Route path="/admin" element={<Admin />} />
                 
                 {/* App routes */}
                 <Route path="/auth" element={<Auth />} />
                 <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                 <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                 <Route path="/wardrobe" element={<ProtectedRoute><Wardrobe /></ProtectedRoute>} />
                  <Route path="/wardrobe/add" element={<ProtectedRoute><AddGarment /></ProtectedRoute>} />
                  <Route path="/wardrobe/scan" element={<ProtectedRoute><LiveScan /></ProtectedRoute>} />
                  <Route path="/wardrobe/:id" element={<ProtectedRoute><GarmentDetail /></ProtectedRoute>} />
                  <Route path="/outfits" element={<ProtectedRoute><Outfits /></ProtectedRoute>} />
                  <Route path="/outfits/generate" element={<ProtectedRoute><OutfitGenerate /></ProtectedRoute>} />
                  <Route path="/outfits/:id" element={<ProtectedRoute><OutfitDetail /></ProtectedRoute>} />
                  <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
                   <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
                  <Route path="/ai" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                 <Route path="/pricing" element={<Pricing />} />
                 <Route path="/billing/success" element={<ProtectedRoute><BillingSuccess /></ProtectedRoute>} />
                 <Route path="/billing/cancel" element={<ProtectedRoute><BillingCancel /></ProtectedRoute>} />
                 <Route path="/share/:id" element={<ShareOutfit />} />
                 <Route path="*" element={<NotFound />} />
               </Routes>
             </BrowserRouter>
           </TooltipProvider>
         </AuthProvider>
       </ThemeProvider>
     </QueryClientProvider>
   </HelmetProvider>
 );

export default App;
