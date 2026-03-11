import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image as ImageIcon, ArrowLeft, Loader2, X, Sparkles, RefreshCw, Link2, Upload, Palette, CheckCircle, Images } from 'lucide-react';
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

const CATEGORY_IDS = ['top', 'bottom', 'shoes', 'outerwear', 'accessory', 'dress'] as const;
const PATTERN_IDS = ['enfärgad', 'randig', 'rutig', 'prickig', 'blommig', 'mönstrad', 'kamouflage'] as const;
const MATERIAL_IDS = ['bomull', 'polyester', 'lin', 'denim', 'läder', 'ull', 'siden', 'syntet'] as const;
const FIT_IDS = ['slim', 'regular', 'loose', 'oversized'] as const;
const SEASON_IDS = ['vår', 'sommar', 'höst', 'vinter'] as const;

const CATEGORY_I18N: Record<string, string> = {
  top: 'garment.category.top', bottom: 'garment.category.bottom', shoes: 'garment.category.shoes',
  outerwear: 'garment.category.outerwear', accessory: 'garment.category.accessory', dress: 'garment.category.dress',
};
const PATTERN_I18N: Record<string, string> = {
  enfärgad: 'garment.pattern.solid', randig: 'garment.pattern.striped', rutig: 'garment.pattern.checked',
  prickig: 'garment.pattern.dotted', blommig: 'garment.pattern.floral', mönstrad: 'garment.pattern.patterned', kamouflage: 'garment.pattern.camo',
};
const MATERIAL_I18N: Record<string, string> = {
  bomull: 'garment.material.cotton', polyester: 'garment.material.polyester', lin: 'garment.material.linen',
  denim: 'garment.material.denim', 'läder': 'garment.material.leather', ull: 'garment.material.wool', siden: 'garment.material.silk', syntet: 'garment.material.synthetic',
};
const FIT_I18N: Record<string, string> = {
  slim: 'garment.fit.slim', regular: 'garment.fit.regular', loose: 'garment.fit.loose', oversized: 'garment.fit.oversized',
};
const SEASON_I18N: Record<string, string> = {
  'vår': 'garment.season.spring', sommar: 'garment.season.summer', 'höst': 'garment.season.autumn', vinter: 'garment.season.winter',
};

// Keep categories/patterns etc. as arrays of { id, label } for backward-compat mapping
const categories = CATEGORY_IDS.map(id => ({ id, label: id }));

const SUBCATEGORY_I18N: Record<string, string> = {
  't-shirt': 'subcategory.tshirt', 'skjorta': 'subcategory.shirt', 'blus': 'subcategory.blouse',
  'tröja': 'subcategory.sweater', 'hoodie': 'subcategory.hoodie', 'polo': 'subcategory.polo',
  'linne': 'subcategory.tank', 'cardigan': 'subcategory.cardigan',
  'jeans': 'subcategory.jeans', 'chinos': 'subcategory.chinos', 'shorts': 'subcategory.shorts',
  'kjol': 'subcategory.skirt', 'kostymbyxor': 'subcategory.dress_pants', 'joggers': 'subcategory.joggers', 'leggings': 'subcategory.leggings',
  'sneakers': 'subcategory.sneakers', 'loafers': 'subcategory.loafers', 'boots': 'subcategory.boots',
  'sandaler': 'subcategory.sandals', 'klackar': 'subcategory.heels', 'träningsskor': 'subcategory.trainers',
  'jacka': 'subcategory.jacket', 'kappa': 'subcategory.coat', 'blazer': 'subcategory.blazer',
  'väst': 'subcategory.vest', 'regnjacka': 'subcategory.rain_jacket', 'dunjacka': 'subcategory.down_jacket',
  'väska': 'subcategory.bag', 'scarf': 'subcategory.scarf', 'mössa': 'subcategory.beanie',
  'bälte': 'subcategory.belt', 'smycke': 'subcategory.jewelry', 'solglasögon': 'subcategory.sunglasses',
  'vardagsklänning': 'subcategory.casual_dress', 'festklänning': 'subcategory.party_dress',
  'maxiklänning': 'subcategory.maxi_dress', 'miniklänning': 'subcategory.mini_dress',
};

const subcategories: Record<string, string[]> = {
  top: ['T-shirt', 'Skjorta', 'Blus', 'Tröja', 'Hoodie', 'Polo', 'Linne', 'Cardigan'],
  bottom: ['Jeans', 'Chinos', 'Shorts', 'Kjol', 'Kostymbyxor', 'Joggers', 'Leggings'],
  shoes: ['Sneakers', 'Loafers', 'Boots', 'Sandaler', 'Klackar', 'Träningsskor'],
  outerwear: ['Jacka', 'Kappa', 'Blazer', 'Väst', 'Regnjacka', 'Dunjacka'],
  accessory: ['Väska', 'Scarf', 'Mössa', 'Bälte', 'Smycke', 'Solglasögon'],
  dress: ['Vardagsklänning', 'Festklänning', 'Maxiklänning', 'Miniklänning'],
};

const COLOR_I18N: Record<string, string> = {
  svart: 'color.svart', vit: 'color.vit', 'grå': 'color.grå', 'marinblå': 'color.marinblå',
  'blå': 'color.blå', 'röd': 'color.röd', 'grön': 'color.grön', beige: 'color.beige',
  brun: 'color.brun', rosa: 'color.rosa', gul: 'color.gul', orange: 'color.orange', lila: 'color.lila',
};

const colors = [
  { id: 'svart', color: 'hsl(0 0% 0%)' },
  { id: 'vit', color: 'hsl(0 0% 100%)' },
  { id: 'grå', color: 'hsl(0 0% 50%)' },
  { id: 'marinblå', color: 'hsl(220 70% 25%)' },
  { id: 'blå', color: 'hsl(210 100% 50%)' },
  { id: 'röd', color: 'hsl(0 100% 50%)' },
  { id: 'grön', color: 'hsl(120 60% 40%)' },
  { id: 'beige', color: 'hsl(40 40% 75%)' },
  { id: 'brun', color: 'hsl(30 50% 30%)' },
  { id: 'rosa', color: 'hsl(350 80% 70%)' },
  { id: 'gul', color: 'hsl(50 100% 50%)' },
  { id: 'orange', color: 'hsl(30 100% 50%)' },
  { id: 'lila', color: 'hsl(280 60% 50%)' },
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
  const { analyzeGarment, isAnalyzing, analysisProgress } = useAnalyzeGarment();
  const { user } = useAuth();
  const { canAddGarment, remainingGarments, refresh: refreshSubscription } = useSubscription();
  const { checkDuplicates, duplicates, clearDuplicates } = useDuplicateDetection();
  const [showDuplicateSheet, setShowDuplicateSheet] = useState(false);

  const [step, setStep] = useState<'upload' | 'analyzing' | 'form' | 'batch'>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [garmentId, setGarmentId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<GarmentAnalysis | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState(0); // 0-3 for 4 phases
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const batchInputRef = useRef<HTMLInputElement>(null);

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
  const handleStartUpload = () => {
    if (!canAddGarment()) {
      setShowPaywall(true);
      return false;
    }
    return true;
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
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check subscription limit
    if (!canAddGarment()) {
      setShowPaywall(true);
      return;
    }

    setImageFile(file);
    
    // Create local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Generate garment ID
    const newGarmentId = crypto.randomUUID();
    setGarmentId(newGarmentId);

    // Upload to storage first
    setStep('analyzing');
    
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${newGarmentId}.${fileExt}`;
      
      await uploadGarmentImage(file, newGarmentId);
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
      });

      const newCount = (garmentCount || 0) + 1;
      if (newCount === 10) {
        toast.success(t('addgarment.milestone'), {
          description: t('addgarment.milestone_desc'),
        });
      } else {
        toast.success(t('addgarment.saved'));
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
        <div className="p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center p-4 space-y-6">
          <h1 className="text-2xl font-bold">{t('addgarment.title')}</h1>

          <Tabs defaultValue="photo" className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="photo" className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {t('addgarment.photo')}
              </TabsTrigger>
              <TabsTrigger value="link" className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                {t('addgarment.link')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photo" className="mt-6">
              <div className="flex flex-col items-center space-y-6">
                <p className="text-muted-foreground text-center">
                  {t('addgarment.photo_prompt')}
                </p>

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

                <div className="flex gap-4">
                  <Button
                    size="lg"
                    className="h-24 w-32 flex-col gap-2"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.capture = 'environment';
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    <Camera className="w-8 h-8" />
                    {t('addgarment.camera')}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-24 w-32 flex-col gap-2"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute('capture');
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    <ImageIcon className="w-8 h-8" />
                    {t('addgarment.gallery')}
                  </Button>
                </div>

                {/* Batch upload button */}
                <Button
                  variant="ghost"
                  className="gap-2 text-muted-foreground"
                  onClick={() => batchInputRef.current?.click()}
                >
                  <Images className="w-4 h-4" />
                  {t('batch.upload_multiple')}
                </Button>
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

  // Analysis phases
  const ANALYSIS_PHASES = [
    { icon: Upload, label: t('addgarment.phase_upload') },
    { icon: Palette, label: t('addgarment.phase_color') },
    { icon: Sparkles, label: t('addgarment.phase_style') },
    { icon: CheckCircle, label: t('addgarment.phase_done') },
  ];

  if (step === 'analyzing') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          {imagePreview && (
            <div className={cn(
              "relative aspect-square w-48 rounded-xl overflow-hidden bg-secondary/60",
              !analysisError && analysisPhase < 3 && "shadow-[0_0_30px_0_hsl(var(--accent)/0.3)] animate-pulse"
            )}>
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Error state */}
          {analysisError ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 w-full"
            >
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
              className="flex flex-col items-center gap-2 bg-card rounded-xl p-4 w-full shadow-sm"
            >
              <CheckCircle className="w-6 h-6 text-accent" />
              <p className="font-medium text-center">{analysisSummary}</p>
              <p className="text-xs text-muted-foreground">{t('addgarment.ai_review')}</p>
            </motion.div>
          ) : (
            /* 4-phase step indicator */
            <div className="flex flex-col gap-3 w-full">
              {ANALYSIS_PHASES.map((phase, i) => {
                const PhaseIcon = phase.icon;
                const isActive = i === analysisPhase;
                const isDone = i < analysisPhase;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: isDone || isActive ? 1 : 0.35, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={cn(
                      "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
                      isActive && "bg-accent/10"
                    )}
                  >
                    {isDone ? (
                      <CheckCircle className="w-5 h-5 text-accent shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                    ) : (
                      <PhaseIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm",
                      isActive && "font-medium text-foreground",
                      isDone && "text-muted-foreground",
                      !isActive && !isDone && "text-muted-foreground"
                    )}>
                      {phase.label}
                    </span>
                  </motion.div>
                );
              })}
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
          <div className="relative aspect-square max-w-xs mx-auto rounded-xl overflow-hidden bg-secondary">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-full object-cover"
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

          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
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
