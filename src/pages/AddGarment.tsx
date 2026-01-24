import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Image as ImageIcon, ArrowLeft, Loader2, X, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCreateGarment, useGarmentCount } from '@/hooks/useGarments';
import { useStorage } from '@/hooks/useStorage';
import { useAnalyzeGarment, GarmentAnalysis } from '@/hooks/useAnalyzeGarment';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';

const categories = [
  { id: 'top', label: 'Överdel' },
  { id: 'bottom', label: 'Underdel' },
  { id: 'shoes', label: 'Skor' },
  { id: 'outerwear', label: 'Ytterkläder' },
  { id: 'accessory', label: 'Accessoar' },
  { id: 'dress', label: 'Klänning' },
];

const subcategories: Record<string, string[]> = {
  top: ['T-shirt', 'Skjorta', 'Blus', 'Tröja', 'Hoodie', 'Polo', 'Linne', 'Cardigan'],
  bottom: ['Jeans', 'Chinos', 'Shorts', 'Kjol', 'Kostymbyxor', 'Joggers', 'Leggings'],
  shoes: ['Sneakers', 'Loafers', 'Boots', 'Sandaler', 'Klackar', 'Träningsskor'],
  outerwear: ['Jacka', 'Kappa', 'Blazer', 'Väst', 'Regnjacka', 'Dunjacka'],
  accessory: ['Väska', 'Scarf', 'Mössa', 'Bälte', 'Smycke', 'Solglasögon'],
  dress: ['Vardagsklänning', 'Festklänning', 'Maxiklänning', 'Miniklänning'],
};

const colors = [
  { id: 'svart', label: 'Svart', color: 'hsl(0 0% 0%)' },
  { id: 'vit', label: 'Vit', color: 'hsl(0 0% 100%)' },
  { id: 'grå', label: 'Grå', color: 'hsl(0 0% 50%)' },
  { id: 'marinblå', label: 'Marinblå', color: 'hsl(220 70% 25%)' },
  { id: 'blå', label: 'Blå', color: 'hsl(210 100% 50%)' },
  { id: 'röd', label: 'Röd', color: 'hsl(0 100% 50%)' },
  { id: 'grön', label: 'Grön', color: 'hsl(120 60% 40%)' },
  { id: 'beige', label: 'Beige', color: 'hsl(40 40% 75%)' },
  { id: 'brun', label: 'Brun', color: 'hsl(30 50% 30%)' },
  { id: 'rosa', label: 'Rosa', color: 'hsl(350 80% 70%)' },
  { id: 'gul', label: 'Gul', color: 'hsl(50 100% 50%)' },
  { id: 'orange', label: 'Orange', color: 'hsl(30 100% 50%)' },
  { id: 'lila', label: 'Lila', color: 'hsl(280 60% 50%)' },
];

const patterns = ['Enfärgad', 'Randig', 'Rutig', 'Prickig', 'Blommig', 'Mönstrad', 'Kamouflage'];
const materials = ['Bomull', 'Polyester', 'Lin', 'Denim', 'Läder', 'Ull', 'Siden', 'Syntet'];
const fits = ['Slim', 'Regular', 'Loose', 'Oversized'];
const seasons = ['Vår', 'Sommar', 'Höst', 'Vinter'];

// Helper to map AI response values to form values
function mapColorToFormValue(aiColor: string | null | undefined): string {
  if (!aiColor) return '';
  const colorLower = aiColor.toLowerCase();
  const colorMatch = colors.find(c => 
    c.id === colorLower || 
    c.label.toLowerCase() === colorLower
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadGarmentImage, getGarmentSignedUrl } = useStorage();
  const createGarment = useCreateGarment();
  const { data: garmentCount } = useGarmentCount();
  const { analyzeGarment, isAnalyzing, analysisProgress } = useAnalyzeGarment();
  const { user } = useAuth();
  const { canAddGarment, remainingGarments, refresh: refreshSubscription } = useSubscription();

  const [step, setStep] = useState<'upload' | 'analyzing' | 'form'>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [garmentId, setGarmentId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<GarmentAnalysis | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

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
    
    const { data: analysisData, error: analysisError } = await analyzeGarment(path);
    
    if (analysisError) {
      toast.error('AI kunde inte analysera – fyll i manuellt.', {
        description: analysisError,
      });
    } else if (analysisData) {
      applyAIAnalysis(analysisData);
      toast.success('AI-analys klar!', {
        description: 'Granska och justera vid behov.',
      });
    }
    
    setStep('form');
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
      toast.error('Kunde inte ladda upp bilden. Försök igen.');
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
      toast.error('Vänligen fyll i alla obligatoriska fält');
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
        toast.success('Nice! 10 plagg inlagda 🎉', {
          description: 'Du har nu tillräckligt för att skapa outfits!',
        });
      } else {
        toast.success('Plagg sparat ✅');
      }

      navigate('/wardrobe');
    } catch (error) {
      console.error('Error saving garment:', error);
      toast.error('Något gick fel. Försök igen.');
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

  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center p-8 space-y-8">
          <h1 className="text-2xl font-bold">Lägg till plagg</h1>
          <p className="text-muted-foreground text-center">
            Ta ett foto eller välj från galleriet
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
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
              Kamera
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
              Galleri
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'analyzing') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          {imagePreview && (
            <div className="relative aspect-square w-48 rounded-xl overflow-hidden bg-secondary">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-lg font-medium">AI analyserar plagget…</span>
          </div>
          <Progress value={analysisProgress} className="w-full" />
          <p className="text-sm text-muted-foreground">
            {analysisProgress < 30 ? 'Laddar upp bild...' : 
             analysisProgress < 70 ? 'Analyserar färg och stil...' : 
             'Slutför analys...'}
          </p>
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
            <h1 className="text-lg font-semibold">Granska plagg</h1>
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
              Analysera igen
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
                  AI-analyserad
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              placeholder="T.ex. Vit linneskjorta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Kategori *</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Välj kategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category && subcategories[category] && (
            <div className="space-y-2">
              <Label>Underkategori</Label>
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj underkategori" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories[category].map((sub) => (
                    <SelectItem key={sub} value={sub.toLowerCase()}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Primär färg *</Label>
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
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sekundär färg (valfri)</Label>
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
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mönster (valfritt)</Label>
            <Select value={pattern} onValueChange={setPattern}>
              <SelectTrigger>
                <SelectValue placeholder="Välj mönster" />
              </SelectTrigger>
              <SelectContent>
                {patterns.map((p) => (
                  <SelectItem key={p} value={p.toLowerCase()}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Material (valfritt)</Label>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger>
                <SelectValue placeholder="Välj material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m} value={m.toLowerCase()}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Passform (valfritt)</Label>
            <Select value={fit} onValueChange={setFit}>
              <SelectTrigger>
                <SelectValue placeholder="Välj passform" />
              </SelectTrigger>
              <SelectContent>
                {fits.map((f) => (
                  <SelectItem key={f} value={f.toLowerCase()}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Säsong</Label>
            <div className="flex flex-wrap gap-2">
              {seasons.map((season) => (
                <Badge
                  key={season}
                  variant={selectedSeasons.includes(season.toLowerCase()) ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => toggleSeason(season.toLowerCase())}
                >
                  {season}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Formalitet</Label>
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
              <span>Casual</span>
              <span>Formellt</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <Label>I tvätt</Label>
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
          Avbryt
        </Button>
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={isLoading || !title || !category || !colorPrimary}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sparar...
            </>
          ) : (
            'Spara plagg'
          )}
        </Button>
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="garments"
      />
    </div>
  );
}
