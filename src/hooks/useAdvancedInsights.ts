import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/* ── Step 8: Spending data ── */
export interface SpendingData {
  totalValue: number;
  currency: string;
  categoryBreakdown: { category: string; total: number; count: number }[];
  topCostPerWear: { id: string; title: string; image_path: string; cpw: number; wears: number; price: number }[];
  worstCostPerWear: { id: string; title: string; image_path: string; cpw: number; wears: number; price: number }[];
}

const LOCALE_CURRENCY: Record<string, string> = {
  sv: 'kr', no: 'kr', da: 'kr',
  fi: '€', de: '€', fr: '€', es: '€', it: '€', pt: '€', nl: '€', fa: '€',
  en: '$', 'en-gb': '£',
  pl: 'zł', ar: 'د.إ',
};

export function useSpendingData(locale?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['spending', user?.id],
    queryFn: async (): Promise<SpendingData | null> => {
      if (!user) return null;
      const { data: garments } = await supabase
        .from('garments')
        .select('id, title, image_path, category, purchase_price, purchase_currency, wear_count')
        .eq('user_id', user.id);
      if (!garments || garments.length === 0) return null;

      const withPrice = garments.filter(g => g.purchase_price && g.purchase_price > 0);
      if (withPrice.length === 0) return null;

      const currency = (locale && LOCALE_CURRENCY[locale]) || withPrice[0].purchase_currency || 'SEK';
      const totalValue = withPrice.reduce((s, g) => s + (g.purchase_price || 0), 0);

      // Category breakdown
      const catMap: Record<string, { total: number; count: number }> = {};
      withPrice.forEach(g => {
        const cat = g.category || 'other';
        if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
        catMap[cat].total += g.purchase_price || 0;
        catMap[cat].count++;
      });
      const categoryBreakdown = Object.entries(catMap)
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.total - a.total);

      // CPW
      const withCPW = withPrice
        .filter(g => (g.wear_count || 0) > 0)
        .map(g => ({
          id: g.id,
          title: g.title,
          image_path: g.image_path,
          cpw: Math.round(((g.purchase_price || 0) / (g.wear_count || 1)) * 100) / 100,
          wears: g.wear_count || 0,
          price: g.purchase_price || 0,
        }))
        .sort((a, b) => a.cpw - b.cpw);

      return {
        totalValue: Math.round(totalValue),
        currency,
        categoryBreakdown,
        topCostPerWear: withCPW.slice(0, 3),
        worstCostPerWear: withCPW.slice(-3).reverse(),
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Step 10: Outfit repeat tracker ── */
export interface OutfitRepeatData {
  repeats: { id: string; occasion: string; wornCount: number; lastWorn: string; daysSince: number }[];
  staleOutfits: { id: string; occasion: string; daysSince: number }[];
}

export function useOutfitRepeats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['outfit-repeats', user?.id],
    queryFn: async (): Promise<OutfitRepeatData | null> => {
      if (!user) return null;
      const { data: outfits } = await supabase
        .from('outfits')
        .select('id, occasion, worn_at, generated_at')
        .eq('user_id', user.id)
        .eq('saved', true);
      if (!outfits || outfits.length === 0) return null;

      const { data: wearLogs } = await supabase
        .from('wear_logs')
        .select('outfit_id, worn_at')
        .eq('user_id', user.id)
        .not('outfit_id', 'is', null);

      const outfitWears: Record<string, { count: number; lastWorn: string }> = {};
      wearLogs?.forEach(l => {
        if (!l.outfit_id) return;
        if (!outfitWears[l.outfit_id]) outfitWears[l.outfit_id] = { count: 0, lastWorn: l.worn_at };
        outfitWears[l.outfit_id].count++;
        if (l.worn_at > outfitWears[l.outfit_id].lastWorn) outfitWears[l.outfit_id].lastWorn = l.worn_at;
      });

      const now = new Date();
      const repeats = outfits
        .filter(o => outfitWears[o.id] && outfitWears[o.id].count > 1)
        .map(o => ({
          id: o.id,
          occasion: o.occasion,
          wornCount: outfitWears[o.id].count,
          lastWorn: outfitWears[o.id].lastWorn,
          daysSince: Math.floor((now.getTime() - new Date(outfitWears[o.id].lastWorn).getTime()) / 86400000),
        }))
        .sort((a, b) => b.wornCount - a.wornCount)
        .slice(0, 5);

      const staleOutfits = outfits
        .filter(o => {
          const lastDate = outfitWears[o.id]?.lastWorn || o.worn_at || o.generated_at;
          if (!lastDate) return true;
          return (now.getTime() - new Date(lastDate).getTime()) / 86400000 > 60;
        })
        .map(o => {
          const lastDate = outfitWears[o.id]?.lastWorn || o.worn_at || o.generated_at;
          return {
            id: o.id,
            occasion: o.occasion,
            daysSince: lastDate ? Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000) : 999,
          };
        })
        .sort((a, b) => b.daysSince - a.daysSince)
        .slice(0, 5);

      return { repeats, staleOutfits };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Step 11: Wear heatmap ── */
export interface WearHeatmapData {
  days: { date: string; status: 'planned' | 'improvised' | 'none' }[];
  streak: number;
  consistency: number; // 0-100
}

export function useWearHeatmap() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wear-heatmap', user?.id],
    queryFn: async (): Promise<WearHeatmapData | null> => {
      if (!user) return null;
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const startStr = ninetyDaysAgo.toISOString().split('T')[0];

      const [wearRes, planRes] = await Promise.all([
        supabase.from('wear_logs').select('worn_at').eq('user_id', user.id).gte('worn_at', startStr),
        supabase.from('planned_outfits').select('date, status').eq('user_id', user.id).gte('date', startStr),
      ]);

      const wornDates = new Set(wearRes.data?.map(w => w.worn_at) || []);
      const plannedDates = new Set(planRes.data?.filter(p => p.status === 'worn').map(p => p.date) || []);

      const days: WearHeatmapData['days'] = [];
      const today = new Date();
      let streak = 0;
      let streakBroken = false;
      let daysWithOutfit = 0;

      for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const worn = wornDates.has(dateStr);
        const planned = plannedDates.has(dateStr);

        if (worn && planned) {
          days.push({ date: dateStr, status: 'planned' });
          daysWithOutfit++;
        } else if (worn) {
          days.push({ date: dateStr, status: 'improvised' });
          daysWithOutfit++;
        } else {
          days.push({ date: dateStr, status: 'none' });
        }
      }

      // Current streak from today backwards
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].status !== 'none') {
          if (!streakBroken) streak++;
        } else {
          if (i < days.length - 1) streakBroken = true;
        }
      }

      return { days, streak, consistency: Math.round((daysWithOutfit / 90) * 100) };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Step 12: Category balance ── */
export interface CategoryBalanceData {
  categories: { name: string; count: number; percentage: number }[];
  total: number;
}

export function useCategoryBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['category-balance', user?.id],
    queryFn: async (): Promise<CategoryBalanceData | null> => {
      if (!user) return null;
      const { data: garments } = await supabase
        .from('garments')
        .select('category')
        .eq('user_id', user.id);
      if (!garments || garments.length === 0) return null;

      const total = garments.length;
      const catCount: Record<string, number> = {};
      garments.forEach(g => {
        catCount[g.category] = (catCount[g.category] || 0) + 1;
      });

      const categories = Object.entries(catCount)
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
        .sort((a, b) => b.count - a.count);

      return { categories, total };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
