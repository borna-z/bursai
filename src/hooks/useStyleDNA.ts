import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Style DNA — detects personal uniform patterns from wear history.
 * Analyzes: color habits, category combos, formality behavior,
 * silhouette tendencies, time-of-week patterns, and comfort direction.
 */

export interface StyleDNAPattern {
  label: string;
  strength: number; // 0–100
  detail: string;
}

export interface StyleDNA {
  /** Top 3 most-worn color palette */
  signatureColors: { color: string; percentage: number }[];
  /** Dominant formality range */
  formalityCenter: number; // 1–5
  formalitySpread: 'narrow' | 'moderate' | 'wide';
  /** Most repeated category combos (e.g. "t-shirt + jeans + sneakers") */
  uniformCombos: { combo: string[]; count: number }[];
  /** Detected patterns */
  patterns: StyleDNAPattern[];
  /** Overall style archetype summary */
  archetype: string;
  /** Total outfits analyzed */
  outfitsAnalyzed: number;
}

export function useStyleDNA() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['style-dna', user?.id],
    queryFn: async (): Promise<StyleDNA | null> => {
      if (!user) return null;

      // Fetch worn outfits with their items and garment details
      const { data: wearLogs } = await supabase
        .from('wear_logs')
        .select('outfit_id, garment_id, worn_at, occasion')
        .eq('user_id', user.id)
        .order('worn_at', { ascending: false })
        .limit(500);

      if (!wearLogs || wearLogs.length < 5) return null;

      // Get garment details
      const garmentIds = [...new Set(wearLogs.map(w => w.garment_id))];
      const { data: garments } = await supabase
        .from('garments')
        .select('id, category, color_primary, formality, fit, material')
        .eq('user_id', user.id)
        .in('id', garmentIds);

      if (!garments || garments.length < 3) return null;

      const garmentMap = new Map(garments.map(g => [g.id, g]));

      // ── Color analysis ──
      const colorCounts: Record<string, number> = {};
      let totalColorEntries = 0;
      for (const g of garments) {
        const wearCount = wearLogs.filter(w => w.garment_id === g.id).length;
        colorCounts[g.color_primary] = (colorCounts[g.color_primary] || 0) + wearCount;
        totalColorEntries += wearCount;
      }
      const signatureColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([color, count]) => ({
          color,
          percentage: Math.round((count / totalColorEntries) * 100),
        }));

      // ── Formality analysis ──
      const formalityValues = garments
        .filter(g => g.formality != null)
        .map(g => g.formality!);
      const formalityCenter = formalityValues.length > 0
        ? Math.round((formalityValues.reduce((s, v) => s + v, 0) / formalityValues.length) * 10) / 10
        : 3;
      const formalityStd = formalityValues.length > 2
        ? Math.sqrt(formalityValues.reduce((s, v) => s + (v - formalityCenter) ** 2, 0) / formalityValues.length)
        : 1;
      const formalitySpread: StyleDNA['formalitySpread'] =
        formalityStd < 0.8 ? 'narrow' : formalityStd < 1.5 ? 'moderate' : 'wide';

      // ── Category combo detection ──
      // Group wear logs by outfit_id to find worn-together combos
      const outfitGroups = new Map<string, string[]>();
      for (const log of wearLogs) {
        if (!log.outfit_id) continue;
        if (!outfitGroups.has(log.outfit_id)) outfitGroups.set(log.outfit_id, []);
        const g = garmentMap.get(log.garment_id);
        if (g) outfitGroups.get(log.outfit_id)!.push(g.category);
      }

      const comboCounter: Record<string, number> = {};
      for (const [, cats] of outfitGroups) {
        const sorted = [...new Set(cats)].sort().join(' + ');
        comboCounter[sorted] = (comboCounter[sorted] || 0) + 1;
      }
      const uniformCombos = Object.entries(comboCounter)
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([combo, count]) => ({ combo: combo.split(' + '), count }));

      // ── Pattern detection ──
      const patterns: StyleDNAPattern[] = [];

      // Neutral palette tendency
      const neutralColors = ['black', 'white', 'grey', 'beige', 'navy', 'svart', 'vit', 'grå', 'marinblå'];
      const neutralPct = signatureColors
        .filter(c => neutralColors.includes(c.color.toLowerCase()))
        .reduce((s, c) => s + c.percentage, 0);
      if (neutralPct >= 60) {
        patterns.push({
          label: 'Neutral palette',
          strength: Math.min(100, neutralPct),
          detail: `${neutralPct}% of your worn pieces are neutral tones`,
        });
      }

      // Monochrome tendency
      if (signatureColors.length > 0 && signatureColors[0].percentage >= 40) {
        patterns.push({
          label: 'Color loyalty',
          strength: signatureColors[0].percentage,
          detail: `${signatureColors[0].color} dominates at ${signatureColors[0].percentage}%`,
        });
      }

      // Uniform repeater
      if (uniformCombos.length > 0 && uniformCombos[0].count >= 4) {
        patterns.push({
          label: 'Personal uniform',
          strength: Math.min(100, uniformCombos[0].count * 12),
          detail: `${uniformCombos[0].combo.join(' + ')} worn ${uniformCombos[0].count}× — your go-to formula`,
        });
      }

      // Casual-leaning
      if (formalityCenter < 2.5) {
        patterns.push({
          label: 'Comfort-first',
          strength: Math.min(100, Math.round((3 - formalityCenter) * 40)),
          detail: 'Your wardrobe leans relaxed and effortless',
        });
      } else if (formalityCenter > 3.5) {
        patterns.push({
          label: 'Polished dresser',
          strength: Math.min(100, Math.round((formalityCenter - 3) * 40)),
          detail: 'You gravitate toward structured, put-together looks',
        });
      }

      // Fit consistency
      const fitCounts: Record<string, number> = {};
      garments.filter(g => g.fit).forEach(g => {
        fitCounts[g.fit!] = (fitCounts[g.fit!] || 0) + 1;
      });
      const topFit = Object.entries(fitCounts).sort((a, b) => b[1] - a[1])[0];
      if (topFit && topFit[1] / garments.length > 0.5) {
        patterns.push({
          label: `${topFit[0]} silhouette`,
          strength: Math.round((topFit[1] / garments.length) * 100),
          detail: `${Math.round((topFit[1] / garments.length) * 100)}% of pieces are ${topFit[0]} fit`,
        });
      }

      // ── Archetype derivation ──
      let archetype = 'Versatile';
      if (neutralPct >= 70 && formalityCenter <= 3) archetype = 'Minimalist';
      else if (neutralPct >= 70 && formalityCenter > 3) archetype = 'Classic';
      else if (formalityCenter < 2.5) archetype = 'Casual Creative';
      else if (formalityCenter > 4) archetype = 'Sharp Dresser';
      else if (signatureColors.length > 0 && !neutralColors.includes(signatureColors[0].color.toLowerCase())) archetype = 'Color Explorer';
      else if (uniformCombos.length > 0 && uniformCombos[0].count >= 5) archetype = 'Uniform Builder';

      return {
        signatureColors,
        formalityCenter,
        formalitySpread,
        uniformCombos,
        patterns: patterns.sort((a, b) => b.strength - a.strength).slice(0, 4),
        archetype,
        outfitsAnalyzed: outfitGroups.size,
      };
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}
