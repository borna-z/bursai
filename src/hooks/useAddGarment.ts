import { useRef, useState, type ChangeEvent } from 'react';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useCreateGarment, useGarmentCount } from '@/hooks/useGarments';
import { useStorage } from '@/hooks/useStorage';
import { useAnalyzeGarment, type GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useDuplicateDetection } from '@/hooks/useDuplicateDetection';
import { useMedianCamera } from '@/hooks/useMedianCamera';
import { compressImage } from '@/lib/imageCompression';
import { getBulkAddSelectionLimit } from '@/lib/bulkAddLimits';
import { buildGarmentIntelligenceFields, standardizeGarmentAiRaw, triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

const CATEGORY_IDS = ['top', 'bottom', 'shoes', 'outerwear', 'accessory', 'dress'] as const;
const PATTERN_IDS = ['solid', 'striped', 'checked', 'dotted', 'floral', 'patterned', 'camo'] as const;
const MATERIAL_IDS = ['cotton', 'polyester', 'linen', 'denim', 'leather', 'wool', 'silk', 'synthetic'] as const;
const FIT_IDS = ['slim', 'regular', 'loose', 'oversized'] as const;
const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;

export const CATEGORY_I18N: Record<string, string> = {
  top: 'garment.category.top', bottom: 'garment.category.bottom', shoes: 'garment.category.shoes',
  outerwear: 'garment.category.outerwear', accessory: 'garment.category.accessory', dress: 'garment.category.dress',
};
export const PATTERN_I18N: Record<string, string> = {
  solid: 'garment.pattern.solid', striped: 'garment.pattern.striped', checked: 'garment.pattern.checked',
  dotted: 'garment.pattern.dotted', floral: 'garment.pattern.floral', patterned: 'garment.pattern.patterned', camo: 'garment.pattern.camo',
};
export const MATERIAL_I18N: Record<string, string> = {
  cotton: 'garment.material.cotton', polyester: 'garment.material.polyester', linen: 'garment.material.linen',
  denim: 'garment.material.denim', leather: 'garment.material.leather', wool: 'garment.material.wool', silk: 'garment.material.silk', synthetic: 'garment.material.synthetic',
};
export const FIT_I18N: Record<string, string> = {
  slim: 'garment.fit.slim', regular: 'garment.fit.regular', loose: 'garment.fit.loose', oversized: 'garment.fit.oversized',
};
export const SEASON_I18N: Record<string, string> = {
  spring: 'garment.season.spring', summer: 'garment.season.summer', autumn: 'garment.season.autumn', winter: 'garment.season.winter',
};
export const SUBCATEGORY_I18N: Record<string, string> = {
  't-shirt': 'subcategory.tshirt', 'shirt': 'subcategory.shirt', 'blouse': 'subcategory.blouse',
  'sweater': 'subcategory.sweater', 'hoodie': 'subcategory.hoodie', 'polo': 'subcategory.polo',
  'tank': 'subcategory.tank', 'cardigan': 'subcategory.cardigan',
  'jeans': 'subcategory.jeans', 'chinos': 'subcategory.chinos', 'shorts': 'subcategory.shorts',
  'skirt': 'subcategory.skirt', 'dress_pants': 'subcategory.dress_pants', 'joggers': 'subcategory.joggers', 'leggings': 'subcategory.leggings',
  'sneakers': 'subcategory.sneakers', 'loafers': 'subcategory.loafers', 'boots': 'subcategory.boots',
  'sandals': 'subcategory.sandals', 'heels': 'subcategory.heels', 'trainers': 'subcategory.trainers',
  'jacket': 'subcategory.jacket', 'coat': 'subcategory.coat', 'blazer': 'subcategory.blazer',
  'vest': 'subcategory.vest', 'rain_jacket': 'subcategory.rain_jacket', 'down_jacket': 'subcategory.down_jacket',
  'bag': 'subcategory.bag', 'scarf': 'subcategory.scarf', 'beanie': 'subcategory.beanie',
  'belt': 'subcategory.belt', 'jewelry': 'subcategory.jewelry', 'sunglasses': 'subcategory.sunglasses',
  'casual_dress': 'subcategory.casual_dress', 'party_dress': 'subcategory.party_dress',
  'maxi_dress': 'subcategory.maxi_dress', 'mini_dress': 'subcategory.mini_dress',
};
export const COLOR_I18N: Record<string, string> = {
  black: 'color.black', white: 'color.white', grey: 'color.grey', navy: 'color.navy',
  blue: 'color.blue', red: 'color.red', green: 'color.green', beige: 'color.beige',
  brown: 'color.brown', pink: 'color.pink', yellow: 'color.yellow', orange: 'color.orange', purple: 'color.purple',
};

export const categories = CATEGORY_IDS.map((id) => ({ id, label: id }));
export const subcategories: Record<string, string[]> = {
  top: ['T-shirt', 'Shirt', 'Blouse', 'Sweater', 'Hoodie', 'Polo', 'Tank', 'Cardigan'],
  bottom: ['Jeans', 'Chinos', 'Shorts', 'Skirt', 'Dress_pants', 'Joggers', 'Leggings'],
  shoes: ['Sneakers', 'Loafers', 'Boots', 'Sandals', 'Heels', 'Trainers'],
  outerwear: ['Jacket', 'Coat', 'Blazer', 'Vest', 'Rain_jacket', 'Down_jacket'],
  accessory: ['Bag', 'Scarf', 'Beanie', 'Belt', 'Jewelry', 'Sunglasses'],
  dress: ['Casual_dress', 'Party_dress', 'Maxi_dress', 'Mini_dress'],
};
export const colors = [
  { id: 'black', color: 'hsl(0 0% 0%)' },
  { id: 'white', color: 'hsl(0 0% 100%)' },
  { id: 'grey', color: 'hsl(0 0% 50%)' },
  { id: 'navy', color: 'hsl(220 70% 25%)' },
  { id: 'blue', color: 'hsl(210 100% 50%)' },
  { id: 'red', color: 'hsl(0 100% 50%)' },
  { id: 'green', color: 'hsl(120 60% 40%)' },
  { id: 'beige', color: 'hsl(40 40% 75%)' },
  { id: 'brown', color: 'hsl(30 50% 30%)' },
  { id: 'pink', color: 'hsl(350 80% 70%)' },
  { id: 'yellow', color: 'hsl(50 100% 50%)' },
  { id: 'orange', color: 'hsl(30 100% 50%)' },
  { id: 'purple', color: 'hsl(280 60% 50%)' },
];
export const patterns = PATTERN_IDS.map((id) => id);
export const materials = MATERIAL_IDS.map((id) => id);
export const fits = FIT_IDS.map((id) => id);
export const seasons = SEASON_IDS.map((id) => id);

function mapColorToFormValue(aiColor: string | null | undefined): string {
  if (!aiColor) return '';
  const colorLower = aiColor.toLowerCase();
  const colorMatch = colors.find((c) => c.id === colorLower || c.id === colorLower);
  return colorMatch?.id || '';
}

function mapCategoryToFormValue(aiCategory: string): string {
  const catLower = aiCategory.toLowerCase();
  const catMatch = categories.find((c) => c.id === catLower);
  return catMatch?.id || '';
}

function mapSubcategoryToFormValue(aiSubcategory: string | null | undefined, category: string): string {
  if (!aiSubcategory || !category || !subcategories[category]) return '';
  const subLower = aiSubcategory.toLowerCase();
  const subMatch = subcategories[category].find((s) => s.toLowerCase() === subLower);
  return subMatch?.toLowerCase() || '';
}

function mapPatternToFormValue(aiPattern: string | null | undefined): string {
  if (!aiPattern) return '';
  const patternLower = aiPattern.toLowerCase();
  const patternMatch = patterns.find((p) => p.toLowerCase() === patternLower);
  return patternMatch?.toLowerCase() || '';
}

function mapMaterialToFormValue(aiMaterial: string | null | undefined): string {
  if (!aiMaterial) return '';
  const materialLower = aiMaterial.toLowerCase();
  const materialMatch = materials.find((m) => m.toLowerCase() === materialLower);
  return materialMatch?.toLowerCase() || '';
}

function mapFitToFormValue(aiFit: string | null | undefined): string {
  if (!aiFit) return '';
  const fitLower = aiFit.toLowerCase();
  const fitMatch = fits.find((f) => f.toLowerCase() === fitLower);
  return fitMatch?.toLowerCase() || '';
}

function mapSeasonTagsToFormValue(aiSeasons: string[]): string[] {
  if (!aiSeasons || !Array.isArray(aiSeasons)) return [];
  return aiSeasons
    .map((s) => s.toLowerCase())
    .filter((s) => seasons.map((ss) => ss.toLowerCase()).includes(s));
}

interface UseAddGarmentParams {
  t: (key: string) => string;
}

export function useAddGarment({ t }: UseAddGarmentParams) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const { uploadGarmentImage, getGarmentSignedUrl } = useStorage();
  const createGarment = useCreateGarment();
  const { data: garmentCount } = useGarmentCount();
  const { analyzeGarment, isAnalyzing } = useAnalyzeGarment();
  const { user } = useAuth();
  const { canAddGarment, remainingGarments, refresh: refreshSubscription } = useSubscription();
  const { checkDuplicates, duplicates, clearDuplicates } = useDuplicateDetection();

  const { takePhoto, pickFromGallery } = useMedianCamera({ fileInputRef });

  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [showDuplicateSheet, setShowDuplicateSheet] = useState(false);
  const [step, setStep] = useState<'upload' | 'analyzing' | 'form' | 'batch'>('upload');
  const [, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [garmentId, setGarmentId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<GarmentAnalysis | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [, setAnalysisPhase] = useState(0);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [colorPrimary, setColorPrimary] = useState('');
  const [colorSecondary, setColorSecondary] = useState('');
  const [pattern, setPattern] = useState('');
  const [material, setMaterial] = useState('');
  const [fit, setFit] = useState('');
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [formality, setFormality] = useState([3]);
  const [inLaundry, setInLaundry] = useState(false);

  const resolveCopy = (key: string, fallback: string) => {
    const translated = t(key);
    return translated && translated !== key ? translated : fallback;
  };

  const applyAIAnalysis = (analysis: GarmentAnalysis) => {
    setAiAnalysis(analysis);
    setTitle(analysis.title || '');

    const mappedCategory = mapCategoryToFormValue(analysis.category);
    setCategory(mappedCategory);
    setSubcategory(mapSubcategoryToFormValue(analysis.subcategory, mappedCategory));

    setColorPrimary(mapColorToFormValue(analysis.color_primary));
    setColorSecondary(mapColorToFormValue(analysis.color_secondary));
    setPattern(mapPatternToFormValue(analysis.pattern));
    setMaterial(mapMaterialToFormValue(analysis.material));
    setFit(mapFitToFormValue(analysis.fit));
    setSelectedSeasons(mapSeasonTagsToFormValue(analysis.season_tags || []));
    setFormality([analysis.formality || 3]);
  };

  const runAnalysis = async (path: string) => {
    setStep('analyzing');
    setAnalysisPhase(0);
    setAnalysisSummary(null);
    setAnalysisError(null);

    const phaseTimer1 = setTimeout(() => setAnalysisPhase(1), 800);
    const phaseTimer2 = setTimeout(() => setAnalysisPhase(2), 2500);

    const { data: analysisData, error } = await analyzeGarment(path);

    clearTimeout(phaseTimer1);
    clearTimeout(phaseTimer2);

    if (error) {
      setAnalysisError(error);
      setAnalysisPhase(0);
      return;
    }

    if (analysisData) {
      setAnalysisPhase(3);
      applyAIAnalysis(analysisData);

      const summary = [analysisData.title, analysisData.material].filter(Boolean).join(', ');
      setAnalysisSummary(summary);

      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success(t('addgarment.ai_success'), {
        description: t('addgarment.ai_review'),
      });

      checkDuplicates({
        image_path: path,
        category: analysisData.category,
        color_primary: analysisData.color_primary,
        title: analysisData.title,
        subcategory: analysisData.subcategory,
        material: analysisData.material || undefined,
      }).then((matches) => {
        if (matches.length > 0) {
          setShowDuplicateSheet(true);
        }
      });
    }

    setStep('form');
  };

  const handleRetryAnalysis = async () => {
    if (!storagePath) return;
    await runAnalysis(storagePath);
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !user) return;

    if (!canAddGarment()) {
      setShowPaywall(true);
      return;
    }

    let file: File | Blob;
    let previewUrl: string;
    try {
      const compressed = await compressImage(rawFile);
      file = compressed.file;
      previewUrl = compressed.previewUrl;
    } catch {
      file = rawFile;
      previewUrl = URL.createObjectURL(rawFile);
    }

    setImageFile(file as File);
    setImagePreview(previewUrl);

    const newGarmentId = crypto.randomUUID();
    setGarmentId(newGarmentId);

    try {
      const fileExt = 'type' in file && file.type === 'image/png' ? 'png' : rawFile.name.split('.').pop() || 'jpg';
      const path = await uploadGarmentImage(file, newGarmentId, {
        extension: fileExt,
        upsert: false,
        filePath: `${user.id}/${newGarmentId}/original.${fileExt}`,
      });
      console.warn('[BURS DEBUG] Upload succeeded, path:', path);
      setStoragePath(path);

      const signedUrl = await getGarmentSignedUrl(path);
      console.warn('[BURS DEBUG] Signed URL obtained');
      setImagePreview(signedUrl);

      await runAnalysis(path);
    } catch (err) {
      console.error('[BURS DEBUG] Upload/analysis error:', err);
      if (err && typeof err === 'object' && 'message' in err) {
        console.error('[BURS DEBUG] Error message:', (err as Record<string, unknown>).message);
      }
      if (err && typeof err === 'object' && 'statusCode' in err) {
        console.error('[BURS DEBUG] Status code:', (err as Record<string, unknown>).statusCode);
      }
      logger.error('Upload/analysis error:', err);
      toast.error(t('addgarment.upload_error'));
      setStep('upload');
    }
  };

  const toggleSeason = (season: string) => {
    setSelectedSeasons((prev) =>
      prev.includes(season) ? prev.filter((s) => s !== season) : [...prev, season],
    );
  };

  const openSaveChoice = () => {
    if (!storagePath || !title || !category || !colorPrimary || !garmentId) {
      toast.error(t('addgarment.fill_required'));
      return;
    }

    setShowConfirmSheet(true);
  };

  const handleSave = async (enableStudioQuality: boolean) => {
    if (!storagePath || !title || !category || !colorPrimary || !garmentId) {
      toast.error(t('addgarment.fill_required'));
      return;
    }

    setIsLoading(true);
    try {
      await createGarment.mutateAsync({
        id: garmentId,
        image_path: storagePath,
        title,
        category,
        subcategory: subcategory || null,
        color_primary: colorPrimary,
        color_secondary: colorSecondary || null,
        pattern: pattern || null,
        material: material || null,
        fit: fit || null,
        season_tags: selectedSeasons.length > 0 ? selectedSeasons : null,
        formality: formality[0],
        in_laundry: inLaundry,
        ai_analyzed_at: aiAnalysis ? new Date().toISOString() : null,
        ai_provider: aiAnalysis?.ai_provider || null,
        ai_raw: standardizeGarmentAiRaw({
          aiRaw: (aiAnalysis?.ai_raw ?? null) as Json,
          analysisConfidence: aiAnalysis?.confidence,
          source: 'add_photo',
        }),
        ...buildGarmentIntelligenceFields({
          storagePath,
          enableRender: enableStudioQuality,
          skipImageProcessing: true,
        }),
      });

      if (storagePath && garmentId && enableStudioQuality) {
        triggerGarmentPostSaveIntelligence({
          garmentId,
          storagePath,
          source: 'add_photo',
          imageProcessing: { mode: 'skip' },
        });
      }

      refreshSubscription();

      const newCount = (garmentCount || 0) + 1;
      // Trigger prefetch for new users hitting 5 garments
      if (newCount === 5) {
        supabase.functions.invoke('prefetch_suggestions', {
          body: { user_id: user?.id, trigger: 'first_5_garments' },
        }).catch(() => {});
      }
      if (newCount === 10) {
        toast.success(t('addgarment.milestone'), {
          description: enableStudioQuality
            ? resolveCopy(
              'addgarment.added_desc',
              'Studio-quality image is processing in the background. You can keep adding garments.',
            )
            : resolveCopy(
              'addgarment.added_original_desc',
              'Saved with the original photo. You can keep adding garments.',
            ),
        });
      } else {
        toast.success(resolveCopy('addgarment.added', 'Saved.'), {
          description: enableStudioQuality
            ? resolveCopy(
              'addgarment.added_desc',
              'Studio-quality image is processing in the background. You can keep adding garments.',
            )
            : resolveCopy(
              'addgarment.added_original_desc',
              'Saved with the original photo. You can keep adding garments.',
            ),
        });
      }
      setShowConfirmSheet(false);
      resetForm();
    } catch (error) {
      logger.error('Error saving garment:', error);
      toast.error(t('common.something_wrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep('upload');
    setShowConfirmSheet(false);
    setImageFile(null);
    setImagePreview(null);
    setStoragePath(null);
    setGarmentId(null);
    setAiAnalysis(null);
    setTitle('');
    setCategory('');
    setSubcategory('');
    setColorPrimary('');
    setColorSecondary('');
    setPattern('');
    setMaterial('');
    setFit('');
    setSelectedSeasons([]);
    setFormality([3]);
    setInLaundry(false);
  };

  const handleBatchSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = remainingGarments();
    const maxBatch = getBulkAddSelectionLimit(remaining);

    if (remaining <= 0) {
      setShowPaywall(true);
      return;
    }

    const fileList = Array.from(files).slice(0, maxBatch);
    if (files.length > maxBatch) {
      toast.info(`${t('batch.limited_to')} ${maxBatch} ${t('batch.items')}`);
    }
    setBatchFiles(fileList);
    setStep('batch');
  };

  return {
    navigate,
    fileInputRef,
    batchInputRef,
    takePhoto,
    pickFromGallery,
    step,
    setStep,
    imagePreview,
    storagePath,
    isLoading,
    garmentId,
    aiAnalysis,
    showPaywall,
    setShowPaywall,
    analysisSummary,
    analysisError,
    batchFiles,
    setBatchFiles,
    title,
    setTitle,
    category,
    setCategory,
    subcategory,
    setSubcategory,
    colorPrimary,
    setColorPrimary,
    colorSecondary,
    setColorSecondary,
    pattern,
    setPattern,
    material,
    setMaterial,
    fit,
    setFit,
    selectedSeasons,
    formality,
    setFormality,
    inLaundry,
    setInLaundry,
    handleImageSelect,
    handleBatchSelect,
    handleRetryAnalysis,
    handleReanalyze: handleRetryAnalysis,
    handleSave,
    openSaveChoice,
    resetForm,
    toggleSeason,
    duplicates,
    clearDuplicates,
    showDuplicateSheet,
    setShowDuplicateSheet,
    showConfirmSheet,
    setShowConfirmSheet,
    isAnalyzing,
    canAddGarment,
    remainingGarments,
    refreshSubscription,
  };
}
