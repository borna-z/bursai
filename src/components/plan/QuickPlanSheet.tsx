import { useState } from 'react';
import { Wand2, Check, Calendar, CloudSun, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { AILoadingOverlay } from '@/components/ui/AILoadingOverlay';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBCP47 } from '@/lib/dateLocale';
import { addDays } from 'date-fns';

interface QuickPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAutoGenerate: (days: number) => Promise<void>;
  isGenerating: boolean;
  generatingDay: number;
}

export function QuickPlanSheet({ open, onOpenChange, onAutoGenerate, isGenerating, generatingDay }: QuickPlanSheetProps) {
  const [isComplete, setIsComplete] = useState(false);
  const { t, locale } = useLanguage();

  const handleAutoGenerate = async () => {
    setIsComplete(false);
    await onAutoGenerate(7);
    setIsComplete(true);
  };

  const progress = isGenerating ? Math.round((generatingDay / 7) * 100) : (isComplete ? 100 : 0);

  const getDayLabel = (dayIndex: number) => {
    const date = addDays(new Date(), dayIndex);
    return date.toLocaleDateString(getBCP47(locale), { weekday: 'long' });
  };

  const planningPhases = [
    { icon: Calendar, label: `${t('plan.creating_for')} ${getDayLabel(generatingDay)}`, duration: 1500 },
    { icon: CloudSun, label: t('plan.adapts_weather'), duration: 1200 },
    { icon: Shirt, label: t('plan.prioritizes_unused'), duration: 0 },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => {
      if (!isGenerating) { setIsComplete(false); onOpenChange(o); }
    }}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('plan.plan_whole_week')}</SheetTitle>
          <SheetDescription>{t('plan.let_ai_fill')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {isGenerating ? (
            <div className="space-y-4">
              <AILoadingOverlay
                variant="inline"
                phases={planningPhases}
                subtitle={`${generatingDay} ${t('plan.of_days')} 7`}
                className="py-4"
              />
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{generatingDay} {t('plan.of_days')} 7</p>
            </div>
          ) : isComplete ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{t('plan.week_planned')}</h3>
              <p className="text-sm text-muted-foreground">{t('plan.week_planned_desc')}</p>
              <Button className="mt-4" onClick={() => { setIsComplete(false); onOpenChange(false); }}>
                {t('plan.show_plan')}
              </Button>
            </div>
          ) : (
            <>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{t('plan.auto_planning')}</p>
                    <p className="text-sm text-muted-foreground">{t('plan.auto_planning_desc')}</p>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-13">
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-primary" />{t('plan.avoids_recent')}</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-primary" />{t('plan.prioritizes_unused')}</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-primary" />{t('plan.adapts_weather')}</li>
                </ul>
              </div>

              <Button onClick={handleAutoGenerate} className="w-full" size="lg">
                <Calendar className="w-4 h-4 mr-2" />{t('plan.plan_7_days')}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
