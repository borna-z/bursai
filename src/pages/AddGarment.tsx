import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Image as ImageIcon, ArrowLeft, Loader2, X, Sparkles, RefreshCw, Link2, Upload, CheckCircle, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCreateGarment, useGarmentCount } from '@/hooks/useGarments';
import { useStorage } from '@/hooks/useStorage';
import { useAnalyzeGarment, GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { LinkImportForm } from '@/components/LinkImportForm';
import { BatchUploadProgress } from '@/components/wardrobe/BatchUploadProgress';
import { DuplicateWarningSheet } from '@/components/wardrobe/DuplicateWarningSheet';
import { useDuplicateDetection } from '@/hooks/useDuplicateDetection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMedianCamera } from '@/hooks/useMedianCamera';
import { compressImage } from '@/lib/imageCompression';
import { GarmentAnalysisState } from '@/components/ui/GarmentAnalysisState';
import { getGarmentProcessingMessage } from '@/lib/garmentImage';
import { buildGarmentIntelligenceFields, standardizeGarmentAiRaw, triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';

const CATEGORY_IDS = ['top', 'bottom', 'shoes', 'outerwear', 'accessory', 'dress'] as const;
const PATTERN_IDS = ['solid', 'striped', 'checked', 'dotted', 'floral', 'patterned', 'camo'] as const;
const MATERIAL_IDS = ['cotton', 'polyester', 'linen', 'denim', 'leather', 'wool', 'silk', 'synthetic'] as const;
const FIT_IDS = ['slim', 'regular', 'loose', 'oversized'] as const;
const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;

const CATEGORY_I18N: Record<string, string> = {
  top: 'garment.category.top', bottom: 'garment.category.bottom', shoes: 'garment.category.shoes',
  outerwear: 'garment.category.outerwear', accessory: 'garment.category.accessory', dress: 'garment.category.dress',
};
const PATTERN_I18N: Record<string, string> = {
  solid: 'garment.pattern.solid', striped: 'garment.pattern.striped', checked: 'garment.pattern.checked',
  dotted: 'garment.pattern.dotted', floral: 'garment.pattern.floral', patterned: 'garment.pattern.patterned', camo: 'garment.pattern.camo',
};
const MATERIAL_I18N: Record<string, string> = {
  cotton: 'garment.material.cotton', polyester: 'garment.material.polyester', linen: 'garment.material.linen',
  denim: 'garment.material.denim', leather: 'garment.material.leather', wool: 'garment.material.wool', silk: 'garment.material.silk', synthetic: 'garment.material.synthetic',
};
const FIT_I18N: Record<string, string> = {
  slim: 'garment.fit.slim', regular: 'garment.fit.regular', loose: 'garment.fit.loose', oversized: 'garment.fit.oversized',
};
const SEASON_I18N: Record<string, string> = {
  spring: 'garment.season.spring', summer: 'garment.season.summer', autumn: 'garment.season.autumn', winter: 'garment.season.winter',
};

// Keep categories/patterns etc. as arrays of { id, label } for backward-compat mapping
const categories = CATEGORY_IDS.map(id => ({ id, label: id }));

const SUBCATEGORY_I18N: Record<string, string> = {
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

const subcategories: Record<string, string[]> = {
  top: ['T-shirt', 'Shirt', 'Blouse', 'Sweater', 'Hoodie', 'Polo', 'Tank', 'Cardigan'],
  bottom: ['Jeans', 'Chinos', 'Shorts', 'Skirt', 'Dress_pants', 'Joggers', 'Leggings'],
  shoes: ['Sneakers', 'Loafers', 'Boots', 'Sandals', 'Heels', 'Trainers'],
  outerwear: ['Jacket', 'Coat', 'Blazer', 'Vest', 'Rain_jacket', 'Down_jacket'],
  accessory: ['Bag', 'Scarf', 'Beanie', 'Belt', 'Jewelry', 'Sunglasses'],
  dress: ['Casual_dress', 'Party_dress', 'Maxi_dress', 'Mini_dress'],
};

const COLOR_I18N: Record<string, string> = {
  black: 'color.black', white: 'color.white', grey: 'color.grey', navy: 'color.navy',
  blue: 'color.blue', red: 'color.red', green: 'color.green', beige: 'color.beige',
  brown: 'color.brown', pink: 'color.pink', yellow: 'color.yellow', orange: 'color.orange', purple: 'color.purple',
};

const colors = [
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

const patterns = PATTERN_IDS.map(id => id);
const materials = MATERIAL_IDS.map(id => id);
const fits = FIT_IDS.map(id => id);
const seasons = SEASON_IDS.map(id => id);

// Helper to map AI response values to form values
function mapColorToFormValue(aiColor: string | null | undefined): string {
  if (!aiColor) return '';
  const colorLower = aiColor.toLowerCase();
  const colorMatch = colors.find(c => 
    c.id === colorLower || 
    c.id === colorLower
  );
  return colorMatch?.id || '';
}

function mapCategoryToFormValue(aiCategory: string): string {
  const catLower = aiCategory.toLowerCase();
  const catMatch = categories.find(c => c.id === catLower);
  return catMatch?.id || '';
}

function mapSubcategoryToFormValue(aiSubcategory: string | null | undefined, category: string): string {
  if (!aiSubcategory || !category || !subcategories[category]) return '';
  const subLower = aiSubcategory.toLowerCase();
  const subMatch = subcategories[category].find(s => s.toLowerCase() === subLower);
  return subMatch?.toLowerCase() || '';
}

function mapPatternToFormValue(aiPattern: string | null | undefined): string {
  if (!aiPattern) return '';
  const patternLower = aiPattern.toLowerCase();
  const patternMatch = patterns.find(p => p.toLowerCase() === patternLower);
  return patternMatch?.toLowerCase() || '';
}

function mapMaterialToFormValue(aiMaterial: string | null | undefined): string {
  if (!aiMaterial) return '';
  const materialLower = aiMaterial.toLowerCase();
  const materialMatch = materials.find(m => m.toLowerCase() === materialLower);
  return materialMatch?.toLowerCase() || '';
}

function mapFitToFormValue(aiFit: string | null | undefined): string {
  if (!aiFit) return '';
  const fitLower = aiFit.toLowerCase();
  const fitMatch = fits.find(f => f.toLowerCase() === fitLower);
  return fitMatch?.toLowerCase() || '';
}

function mapSeasonTagsToFormValue(aiSeasons: string[]): string[] {
  if (!aiSeasons || !Array.isArray(aiSeasons)) return [];
  return aiSeasons
    .map(s => s.toLowerCase())
    .filter(s => seasons.map(ss => ss.toLowerCase()).includes(s));
}
export default function AddGarmentPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadGarmentImage, getGarmentSignedUrl } = useStorage();
  const createGarment = useCreateGarment();
  const { data: garmentCount } = useGarmentCount();
  const { analyzeGarment, isAnalyzing } = useAnalyzeGarment();
  const { user } = useAuth();
  const { canAddGarment, remainingGarments, isPremium, refresh: refreshSubscription } = useSubscription();
  const { checkDuplicates, duplicates, clearDuplicates } = useDuplicateDetection();

  const { takePhoto, pickFromGallery } = useMedianCamera({
    fileInputRef,
  });
  const [showDuplicateSheet, setShowDuplicateSheet] = useState(false);

  const [step, setStep] = useState<'upload' | 'analyzing' | 'form' | 'batch'>('upload');
  const [, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [garmentId, setGarmentId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<GarmentAnalysis | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [, setAnalysisPhase] = useState(0); // 0-3 for 4 phases
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const processingMessage = getGarmentProcessingMessage('processing');
  // Form state
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

  // Check limit on mount

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
    
    // Simulate phase progression (actual analysis drives the final states)
    const phaseTimer1 = setTimeout(() => setAnalysisPhase(1), 800);
    const phaseTimer2 = setTimeout(() => setAnalysisPhase(2), 2500);
    
    const { data: analysisData, error: analysisError } = await analyzeGarment(path);
    
    clearTimeout(phaseTimer1);
    clearTimeout(phaseTimer2);
    
    if (analysisError) {
      setAnalysisError(analysisError);
      setAnalysisPhase(0);
      return; // Stay on analyzing screen with error
    } else if (analysisData) {
      setAnalysisPhase(3); // Done
      applyAIAnalysis(analysisData);
      
      // Build summary string
      const summary = [analysisData.title, analysisData.material].filter(Boolean).join(', ');
      setAnalysisSummary(summary);
      
      // Show summary for 1.5s, then go to form
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success(t('addgarment.ai_success'), {
        description: t('addgarment.ai_review'),
      });

      // Run duplicate detection in background (non-blocking)
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

  const handleReanalyze = async () => {
    if (!storagePath) return;
    await runAnalysis(storagePath);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !user) return;

    // Check subscription limit
    if (!canAddGarment()) {
      setShowPaywall(true);
      return;
    }

    // Compress image before upload (resize + WebP conversion)
    let file: File | Blob;
    let previewUrl: string;
    try {
      const compressed = await compressImage(rawFile);
      file = compressed.file;
      previewUrl = compressed.previewUrl;
    } catch {
      // Fallback to original if compression fails
      file = rawFile;
      previewUrl = URL.createObjectURL(rawFile);
    }

    setImageFile(file as File);
    setImagePreview(previewUrl);

    // Generate garment ID
    const newGarmentId = crypto.randomUUID();
    setGarmentId(newGarmentId);
    
    try {
      const fileExt = 'type' in file && file.type === 'image/png' ? 'png' : (rawFile.name.split('.').pop() || 'jpg');
      const path = await uploadGarmentImage(file, newGarmentId, {
        extension: fileExt,
        upsert: false,
        filePath: `${user.id}/${newGarmentId}/original.${fileExt}`,
      });
      setStoragePath(path);

      // Fetch signed URL for display
      const signedUrl = await getGarmentSignedUrl(path);
      setImagePreview(signedUrl);

      // Run AI analysis
      await runAnalysis(path);
    } catch (err) {
      console.error('Upload/analysis error:', err);
      toast.error(t('addgarment.upload_error'));
      setStep('upload');
    }
  };

  const toggleSeason = (season: string) => {
    setSelectedSeasons((prev) =>
      prev.includes(season) ? prev.filter((s) => s !== season) : [...prev, season]
    );
  };

  const handleSave = async () => {
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
        ...buildGarmentIntelligenceFields({ storagePath }),
      });

      if (storagePath && garmentId) {
        triggerGarmentPostSaveIntelligence({
          garmentId,
          storagePath,
          source: 'add_photo',
          imageProcessing: { mode: 'edge' },
        });
      }

      const newCount = (garmentCount || 0) + 1;
      if (newCount === 10) {
        toast.success(t('addgarment.milestone'), {
          description: t('addgarment.milestone_desc'),
        });
      } else {
        toast.success('Added to wardrobe', {
          description: 'Background cleanup will finish automatically.',
        });
      }

      navigate('/wardrobe');
    } catch (error) {
      console.error('Error saving garment:', error);
      toast.error(t('common.something_wrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep('upload');
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

  // Batch upload handler
  const handleBatchSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const remaining = remainingGarments();
    const maxBatch = Math.min(10, remaining);
    
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

  if (step === 'batch') {
    return (
      <BatchUploadProgress
        files={batchFiles}
        onComplete={() => {
          refreshSubscription();
          navigate('/wardrobe');
        }}
        onCancel={() => {
          setBatchFiles([]);
          setStep('upload');
        }}
      />
    );
  }

  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-background">
        {/* Minimal top bar */}
        <div className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {!isPremium && (
            <span className="text-xs text-muted-foreground">
              {remainingGarments()} {t('scan.slots_left') || 'left'}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center px-6 pt-8 pb-12 space-y-8 max-w-md mx-auto">
          {/* Hero icon */}
          <div className="space-y-3 text-center">
            <div className="w-16 h-16 bg-accent/10 flex items-center justify-center mx-auto">
              <Upload className="w-7 h-7 text-accent" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">{t('addgarment.title')}</h1>
            <p className="text-sm text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
              {t('addgarment.photo_prompt')}
            </p>
            <p className="text-xs text-muted-foreground/80 max-w-[260px] mx-auto">
              Your item appears as soon as you save it. Any cleanup finishes quietly in the background.
            </p>
          </div>

          <Tabs defaultValue="photo" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11">
              <TabsTrigger value="photo" className="flex items-center gap-2 text-sm">
                <Camera className="w-4 h-4" />
                {t('addgarment.photo')}
              </TabsTrigger>
              <TabsTrigger value="link" className="flex items-center gap-2 text-sm">
                <Link2 className="w-4 h-4" />
                {t('addgarment.link')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photo" className="mt-6">
              <div className="flex flex-col items-center space-y-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  ref={batchInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBatchSelect}
                  className="hidden"
                />

                {/* Primary capture cards */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => takePhoto()}
                    className="group flex flex-col items-center gap-3 p-6 border border-border/50 bg-card hover:border-accent/40 hover:bg-accent/5 transition-all"
                  >
                    <div className="w-12 h-12 bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                      <Camera className="w-6 h-6 text-accent" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{t('addgarment.camera')}</span>
                  </button>
                  <button
                    onClick={() => pickFromGallery()}
                    className="group flex flex-col items-center gap-3 p-6 border border-border/50 bg-card hover:border-accent/40 hover:bg-accent/5 transition-all"
                  >
                    <div className="w-12 h-12 bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <ImageIcon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{t('addgarment.gallery')}</span>
                  </button>
                </div>

                {/* Batch upload — tertiary action */}
                <button
                  onClick={() => batchInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  <Images className="w-4 h-4" />
                  {t('batch.upload_multiple')}
                </button>
              </div>
            </TabsContent>

            <TabsContent value="link" className="mt-6">
              <LinkImportForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  if (step === 'analyzing') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          {/* Error state */}
          {analysisError ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 w-full"
            >
              {imagePreview && (
                <div className="aspect-square w-48 overflow-hidden bg-secondary/60">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <p className="text-sm text-destructive text-center">{analysisError}</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={resetForm}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleRetryAnalysis}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('addgarment.retry')}
                </Button>
              </div>
            </motion.div>
          ) : analysisSummary ? (
            /* Summary card */
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex flex-col items-center gap-2 bg-card p-4 w-full shadow-sm"
            >
              <CheckCircle className="w-6 h-6 text-accent" />
              <p className="font-medium text-center">{analysisSummary}</p>
              <p className="text-xs text-muted-foreground">{t('addgarment.ai_review')}</p>
              <p className="text-xs text-muted-foreground">{processingMessage?.label ?? 'Creating clean wardrobe image'}</p>
            </motion.div>
          ) : (
            /* GarmentAnalysisState */
            <div className="w-full space-y-4">
              <GarmentAnalysisState imageUrl={imagePreview} />
              <div className="space-y-2">
                <Progress value={undefined} className="h-1.5 animate-pulse" />
                <p className="text-sm text-muted-foreground text-center">
                  {processingMessage?.label ?? 'Creating clean wardrobe image'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">{t('addgarment.review')}</h1>
          </div>
          {storagePath && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled={isAnalyzing}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isAnalyzing && "animate-spin")} />
              {t('addgarment.reanalyze')}
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Image Preview */}
        {imagePreview && (
          <div className="relative aspect-square max-w-xs mx-auto overflow-hidden bg-[hsl(36_33%_93%)]">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2"
              onClick={resetForm}
            >
              <X className="w-4 h-4" />
            </Button>
            {aiAnalysis && (
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('addgarment.ai_analyzed')}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('addgarment.form.title')} *</Label>
            <Input
              placeholder={t('addgarment.form.title_placeholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.category')} *</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(''); }}>
              <SelectTrigger>
                <SelectValue placeholder={t('addgarment.form.select_category')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {t(CATEGORY_I18N[cat.id] || cat.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category && subcategories[category] && (
            <div className="space-y-2">
              <Label>{t('addgarment.form.subcategory')}</Label>
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t('addgarment.form.select_subcategory')} />
                </SelectTrigger>
                <SelectContent>
                  {subcategories[category].map((sub) => (
                    <SelectItem key={sub} value={sub.toLowerCase()}>
                      {t(SUBCATEGORY_I18N[sub.toLowerCase()] || sub)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('addgarment.form.primary_color')} *</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColorPrimary(c.id)}
                  className={cn(
                    'w-10 h-10 rounded-full border-2 transition-all',
                    colorPrimary === c.id
                      ? 'ring-2 ring-primary ring-offset-2 border-primary'
                      : 'border-border hover:scale-110'
                  )}
                  style={{ backgroundColor: c.color }}
                  title={t(COLOR_I18N[c.id] || c.id)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.secondary_color')}</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColorSecondary('')}
                className={cn(
                  'w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center',
                  !colorSecondary ? 'ring-2 ring-primary ring-offset-2' : 'border-border'
                )}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              {colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColorSecondary(c.id)}
                  className={cn(
                    'w-10 h-10 rounded-full border-2 transition-all',
                    colorSecondary === c.id
                      ? 'ring-2 ring-primary ring-offset-2 border-primary'
                      : 'border-border hover:scale-110'
                  )}
                  style={{ backgroundColor: c.color }}
                  title={t(COLOR_I18N[c.id] || c.id)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.pattern')}</Label>
            <Select value={pattern} onValueChange={setPattern}>
              <SelectTrigger>
                <SelectValue placeholder={t('addgarment.form.select_pattern')} />
              </SelectTrigger>
              <SelectContent>
                {patterns.map((p) => (
                  <SelectItem key={p} value={p.toLowerCase()}>
                    {t(PATTERN_I18N[p.toLowerCase()] || p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.material')}</Label>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger>
                <SelectValue placeholder={t('addgarment.form.select_material')} />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m} value={m.toLowerCase()}>
                    {t(MATERIAL_I18N[m.toLowerCase()] || m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.fit')}</Label>
            <Select value={fit} onValueChange={setFit}>
              <SelectTrigger>
                <SelectValue placeholder={t('addgarment.form.select_fit')} />
              </SelectTrigger>
              <SelectContent>
                {fits.map((f) => (
                  <SelectItem key={f} value={f.toLowerCase()}>
                    {t(FIT_I18N[f.toLowerCase()] || f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.season')}</Label>
            <div className="flex flex-wrap gap-2">
              {seasons.map((season) => (
                <Badge
                  key={season}
                  variant={selectedSeasons.includes(season.toLowerCase()) ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => toggleSeason(season.toLowerCase())}
                >
                  {t(SEASON_I18N[season.toLowerCase()] || season)}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('addgarment.form.formality')}</Label>
              <span className="text-sm text-muted-foreground">
                {formality[0]} / 5
              </span>
            </div>
            <Slider
              value={formality}
              onValueChange={setFormality}
              max={5}
              min={1}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('addgarment.form.casual')}</span>
              <span>{t('addgarment.form.formal')}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary">
            <Label>{t('addgarment.form.in_laundry')}</Label>
            <Switch checked={inLaundry} onCheckedChange={setInLaundry} />
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex gap-3 max-w-lg mx-auto">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate('/wardrobe')}
          disabled={isLoading}
        >
          {t('common.cancel')}
        </Button>
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={isLoading || !title || !category || !colorPrimary}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('addgarment.saving')}
            </>
          ) : (
            t('addgarment.save')
          )}
        </Button>
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="garments"
      />

      {/* Duplicate Warning Sheet */}
      <DuplicateWarningSheet
        open={showDuplicateSheet}
        onOpenChange={setShowDuplicateSheet}
        duplicates={duplicates}
        onKeepBoth={() => {
          setShowDuplicateSheet(false);
          clearDuplicates();
        }}
        onReplace={async (existingGarmentId) => {
          // Delete the existing garment and keep the new one
          setShowDuplicateSheet(false);
          clearDuplicates();
          try {
            await supabase.from('garments').delete().eq('id', existingGarmentId);
            toast.success(t('duplicate.replaced') || 'Old garment replaced');
          } catch {
            toast.error(t('common.something_wrong'));
          }
        }}
        onCancel={() => {
          setShowDuplicateSheet(false);
          clearDuplicates();
          resetForm();
        }}
      />
    </div>
  );
}
