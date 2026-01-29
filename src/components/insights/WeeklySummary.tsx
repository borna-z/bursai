import { useMemo } from 'react';
import { Flame, TrendingUp, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';

interface Garment {
  id: string;
  title: string;
  image_path: string;
  wear_count?: number;
  category: string;
}

interface WeeklySummaryProps {
  garments: Garment[];
  wearLogs: { worn_at: string; garment_id: string }[];
  isPremium: boolean;
}

export function WeeklySummary({ garments, wearLogs, isPremium }: WeeklySummaryProps) {
  const { streak, mostWornThisWeek } = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Calculate streak (consecutive days with outfit usage)
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasWear = wearLogs.some(log => log.worn_at.startsWith(dateStr));
      
      if (hasWear) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }
    
    // Most worn this week
    const weeklyWears = wearLogs.filter(log => new Date(log.worn_at) >= weekAgo);
    const wearCounts: Record<string, number> = {};
    
    weeklyWears.forEach(log => {
      wearCounts[log.garment_id] = (wearCounts[log.garment_id] || 0) + 1;
    });
    
    const topGarmentId = Object.entries(wearCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    
    const topGarment = garments.find(g => g.id === topGarmentId);
    
    return {
      streak: currentStreak,
      mostWornThisWeek: topGarment,
    };
  }, [garments, wearLogs]);

  return (
    <Card className={cn(!isPremium && "relative overflow-hidden")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Veckosammanfattning</CardTitle>
        </div>
        <CardDescription>Din stil denna vecka</CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-4", !isPremium && "blur-sm select-none")}>
        {/* Streak */}
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold">{streak} dagar</p>
            <p className="text-sm text-muted-foreground">Användningsstreak</p>
          </div>
          {streak >= 7 && (
            <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0">
              🔥 On fire!
            </Badge>
          )}
        </div>
        
        {/* Most worn this week */}
        {mostWornThisWeek && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
            <LazyImageSimple
              imagePath={mostWornThisWeek.image_path}
              alt={mostWornThisWeek.title}
              className="w-12 h-12 rounded-lg flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{mostWornThisWeek.title}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Award className="w-3 h-3" />
                Mest använd denna vecka
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
