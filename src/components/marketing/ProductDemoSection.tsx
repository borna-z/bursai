import { useState } from 'react';
import { Camera, Sparkles, Calendar, BarChart3 } from 'lucide-react';
import { MARKETING_CONFIG } from '@/config/marketing';
import { trackMarketingEvent } from '@/lib/marketingAnalytics';
import { cn } from '@/lib/utils';

import demoWardrobe from '@/assets/demo-wardrobe.jpg';
import demoOutfit from '@/assets/demo-outfit.jpg';
import demoPlan from '@/assets/demo-plan.jpg';
import demoInsights from '@/assets/demo-insights.jpg';

const iconMap = {
  camera: Camera,
  sparkles: Sparkles,
  calendar: Calendar,
  chart: BarChart3,
};

const stepScreenshots = [demoWardrobe, demoOutfit, demoPlan, demoInsights];

export function ProductDemoSection() {
  const { demo } = MARKETING_CONFIG;
  const [activeStep, setActiveStep] = useState(0);

  const handleStepClick = (index: number) => {
    setActiveStep(index);
    trackMarketingEvent('demo_step_click', { step: demo.steps[index].id });
  };

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section headline */}
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 md:mb-16">
          {demo.headline}
        </h2>
        
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Phone mockup with real screenshot */}
          <div className="relative order-2 md:order-1">
            <div className="relative mx-auto w-[280px] md:w-[320px]">
              {/* Phone frame */}
              <div className="relative bg-foreground rounded-[3rem] p-3 shadow-2xl">
                {/* Screen */}
                <div className="relative bg-background rounded-[2.5rem] overflow-hidden aspect-[9/19]">
                  {/* Real screenshot */}
                  <img
                    key={activeStep}
                    src={stepScreenshots[activeStep]}
                    alt={demo.steps[activeStep]?.title || 'App screenshot'}
                    className="absolute inset-0 w-full h-full object-cover animate-fade-in"
                  />
                  
                  {/* Home indicator */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-foreground/20 rounded-full z-10" />
                </div>
              </div>
              
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent rounded-full blur-3xl -z-10" />
            </div>
          </div>
          
          {/* Steps */}
          <div className="order-1 md:order-2 space-y-4">
            {demo.steps.map((step, index) => {
              const Icon = iconMap[step.icon as keyof typeof iconMap];
              const isActive = index === activeStep;
              
              return (
                <button
                  key={step.id}
                  onClick={() => handleStepClick(index)}
                  className={cn(
                    'w-full text-left p-5 rounded-xl border transition-all duration-300',
                    isActive
                      ? 'bg-primary/5 border-primary/20 shadow-sm'
                      : 'bg-card border-border/50 hover:border-border hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">Steg {index + 1}</span>
                      </div>
                      <h3 className="font-semibold mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
