import { useState } from 'react';
import { X, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useUpdateGarment, type Garment } from '@/hooks/useGarments';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const categoryOptions = ['top', 'bottom', 'shoes', 'outerwear', 'accessory', 'dress'];
const colorOptionIds = ['svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun'];
const formalityOptions = [1, 2, 3, 4, 5];

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  top: 'quickedit.cat.top',
  bottom: 'quickedit.cat.bottom',
  shoes: 'quickedit.cat.shoes',
  outerwear: 'quickedit.cat.outerwear',
  accessory: 'quickedit.cat.accessory',
};

interface QuickEditItemProps {
  garment: Garment;
  onDone: () => void;
}

function QuickEditItem({ garment, onDone }: QuickEditItemProps) {
  const { t } = useLanguage();
  const updateGarment = useUpdateGarment();
  const [category, setCategory] = useState(garment.category);
  const [color, setColor] = useState(garment.color_primary);
  const [formality, setFormality] = useState(garment.formality || 3);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = 
    category !== garment.category || 
    color !== garment.color_primary || 
    formality !== garment.formality;

  const handleSave = async () => {
    if (!hasChanges) {
      onDone();
      return;
    }

    setIsSaving(true);
    try {
      await updateGarment.mutateAsync({
        id: garment.id,
        updates: {
          category,
          color_primary: color,
          formality,
        },
      });
      toast.success(t('quickedit.updated'));
      onDone();
    } catch {
      toast.error(t('quickedit.save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex gap-3">
          <LazyImageSimple
            imagePath={garment.image_path}
            alt={garment.title}
            className="w-20 h-20 rounded-lg flex-shrink-0"
          />
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm truncate">{garment.title}</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {t('quickedit.new_badge')}
                </Badge>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </Button>
            </div>
            
            {/* Category chips */}
            <div className="flex flex-wrap gap-1">
              {categoryOptions.slice(0, 4).map((cat) => (
                <Chip
                  key={cat}
                  size="sm"
                  selected={category === cat}
                  onClick={() => setCategory(cat)}
                  className="capitalize text-xs"
                >
                  {t(CATEGORY_LABEL_KEYS[cat] || cat)}
                </Chip>
              ))}
            </div>
            
            {/* Color chips */}
            <div className="flex flex-wrap gap-1">
              {colorOptionIds.slice(0, 5).map((c) => (
                <Chip
                  key={c}
                  size="sm"
                  selected={color === c}
                  onClick={() => setColor(c)}
                  className="capitalize text-xs"
                >
                  {t(`color.${c}`)}
                </Chip>
              ))}
            </div>
            
            {/* Formality */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('quickedit.formality')}</span>
              <div className="flex gap-1">
                {formalityOptions.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormality(f)}
                    className={cn(
                      "w-6 h-6 rounded-full text-xs font-medium transition-all",
                      formality === f 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickEditPanelProps {
  garments: Garment[];
  onClose: () => void;
}

export function QuickEditPanel({ garments, onClose }: QuickEditPanelProps) {
  const { t } = useLanguage();
  const [remainingGarments, setRemainingGarments] = useState(garments);

  const handleDone = (garmentId: string) => {
    setRemainingGarments(prev => prev.filter(g => g.id !== garmentId));
  };

  if (remainingGarments.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {t('quickedit.title')} ({remainingGarments.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('quickedit.desc')}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {remainingGarments.slice(0, 5).map((garment) => (
          <QuickEditItem 
            key={garment.id} 
            garment={garment} 
            onDone={() => handleDone(garment.id)}
          />
        ))}
        {remainingGarments.length > 5 && (
          <p className="text-sm text-center text-muted-foreground">
            {t('quickedit.more_garments').replace('{count}', String(remainingGarments.length - 5))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
