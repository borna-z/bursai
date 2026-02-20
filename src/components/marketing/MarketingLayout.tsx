import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MARKETING_CONFIG } from '@/config/marketing';
import { trackMarketingEvent } from '@/lib/marketingAnalytics';
import { cn } from '@/lib/utils';
import { DrapeLogo } from '@/components/ui/DrapeLogo';
 
 interface MarketingLayoutProps {
   children: React.ReactNode;
   className?: string;
 }
 
 export function MarketingLayout({ children, className }: MarketingLayoutProps) {
   useEffect(() => {
     trackMarketingEvent('page_view');
   }, []);
 
   return (
     <div className={cn('min-h-screen bg-background text-foreground', className)}>
       {/* Navigation */}
       <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
         <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            to="/marketing" 
            className="hover:opacity-80 transition-opacity"
          >
            <DrapeLogo variant="horizontal" size="sm" />
          </Link>
           <nav className="flex items-center gap-4">
             <Link
               to={MARKETING_CONFIG.appUrl}
               className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
               onClick={() => trackMarketingEvent('cta_open_app_click')}
             >
               {MARKETING_CONFIG.hero.primaryCta}
             </Link>
           </nav>
         </div>
       </header>
 
       {/* Main content */}
       <main className="pt-16">
         {children}
       </main>
 
       {/* Footer */}
       <footer className="border-t border-border/50 bg-muted/30">
         <div className="max-w-6xl mx-auto px-4 py-12">
           <div className="flex flex-col md:flex-row justify-between items-center gap-6">
             <p className="text-sm text-muted-foreground">
               {MARKETING_CONFIG.footer.copyright}
             </p>
             <nav className="flex items-center gap-6">
               {MARKETING_CONFIG.footer.links.map((link) => (
                 <Link
                   key={link.href}
                   to={link.href}
                   className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                 >
                   {link.label}
                 </Link>
               ))}
             </nav>
           </div>
         </div>
       </footer>
     </div>
   );
 }