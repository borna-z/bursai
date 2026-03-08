import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, WashingMachine, Check, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useGarment, useUpdateGarment, useDeleteGarment, useMarkGarmentWorn } from '@/hooks/useGarments';
import { LazyImage } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBCP47 } from '@/lib/dateLocale';

export default function GarmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const { data: garment, isLoading } = useGarment(id);
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  const markWorn = useMarkGarmentWorn();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <Skeleton className="aspect-[3/4] w-full rounded-b-3xl" />
        <div className="px-6 pt-8 space-y-6">
          <div>
            <Skeleton className="h-7 w-2/3 mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-8">
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-12 w-20" />
          </div>
        </div>
      </div>
    );
  }

  if (!garment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg font-medium mb-4">{t('garment.not_found')}</p>
        <Button variant="outline" onClick={() => navigate('/wardrobe')}>{t('common.back')}</Button>
      </div>
    );
  }

  const handleToggleLaundry = async () => {
    try {
      await updateGarment.mutateAsync({ id: garment.id, updates: { in_laundry: !garment.in_laundry } });
      toast.success(garment.in_laundry ? t('garment.available') : t('garment.in_laundry'));
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleMarkWorn = async () => {
    try {
      await markWorn.mutateAsync(garment.id);
      toast.success(t('garment.marked'));
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleDelete = async () => {
    try {
      await deleteGarment.mutateAsync(garment.id);
      toast.success(t('garment.deleted'));
      navigate('/wardrobe');
    } catch { toast.error(t('common.something_wrong')); }
  };

  // Build metadata string
  const metaParts: string[] = [];
  if (garment.color_primary) metaParts.push(t(`color.${garment.color_primary}`));
  if (garment.color_secondary) metaParts.push(t(`color.${garment.color_secondary}`));
  if (garment.material) metaParts.push(t(`garment.material.${garment.material}`));
  if (garment.pattern && garment.pattern !== 'solid') metaParts.push(t(`garment.pattern.${garment.pattern}`));
  if (garment.fit) metaParts.push(t(`garment.fit.${garment.fit}`));

  const seasonParts: string[] = [];
  garment.season_tags?.forEach((season) => {
    const key = season === 'vår' ? 'spring' : season === 'sommar' ? 'summer' : season === 'höst' ? 'autumn' : season === 'vinter' ? 'winter' : season;
    seasonParts.push(t(`garment.season.${key}`));
  });
  if (garment.formality) seasonParts.push(`${t('garment.formality')} ${garment.formality}/5`);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Hero image with floating controls */}
      <div className="relative rounded-b-3xl overflow-hidden">
        <LazyImage imagePath={garment.image_path} alt={garment.title} aspectRatio="3/4" className="w-full !rounded-none" />
        
        {/* Floating back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 backdrop-blur-xl bg-background/40 rounded-full h-10 w-10 shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Floating action buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/wardrobe/${garment.id}/edit`)}
            className="backdrop-blur-xl bg-background/40 rounded-full h-10 w-10 shadow-lg"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="backdrop-blur-xl bg-background/40 rounded-full h-10 w-10 shadow-lg">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('garment.delete_confirm')}</AlertDialogTitle>
                <AlertDialogDescription>"{garment.title}" {t('garment.delete_desc')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pt-8 space-y-8 max-w-lg mx-auto">
        {/* Title + category */}
        <div>
          <h1 className="text-2xl font-semibold">{garment.title}</h1>
          <p className="text-[13px] text-muted-foreground/60 uppercase tracking-wide mt-1">
            {t(`garment.category.${garment.category}`) || garment.subcategory || garment.category}
          </p>
        </div>

        {/* Metadata — dot-separated */}
        {metaParts.length > 0 && (
          <p className="text-[13px] text-muted-foreground capitalize">
            {metaParts.join(' · ')}
          </p>
        )}
        {seasonParts.length > 0 && (
          <p className="text-[13px] text-muted-foreground/60 capitalize -mt-4">
            {seasonParts.join(' · ')}
          </p>
        )}

        {/* Stats */}
        <div className="flex">
          <div className="flex-1 text-center">
            <p className="text-3xl font-light tabular-nums">{garment.wear_count || 0}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mt-1">{t('garment.worn_count')}</p>
          </div>
          <div className="w-px bg-border/20" />
          <div className="flex-1 text-center">
            <p className="text-3xl font-light tabular-nums">
              {garment.last_worn_at
                ? new Date(garment.last_worn_at).toLocaleDateString(getBCP47(locale), { day: 'numeric', month: 'short' })
                : '—'}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mt-1">{t('garment.last_worn')}</p>
          </div>
        </div>

        {/* Source URL */}
        {garment.source_url && (
          <a
            href={garment.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t('garment.imported')}</span>
          </a>
        )}

        {/* Laundry toggle */}
        <div className="flex items-center justify-between py-4 border-t border-border/10">
          <div className="flex items-center gap-3">
            <WashingMachine className="w-5 h-5 text-muted-foreground/50" />
            <span className="text-sm">{t('garment.in_laundry')}</span>
          </div>
          <Switch checked={garment.in_laundry || false} onCheckedChange={handleToggleLaundry} disabled={updateGarment.isPending} />
        </div>

        {/* Mark worn */}
        <Button variant="outline" className="w-full rounded-2xl h-12" onClick={handleMarkWorn} disabled={markWorn.isPending}>
          {markWorn.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          {t('garment.mark_worn')}
        </Button>

        {/* AI analyzed */}
        {garment.ai_analyzed_at && (
          <p className="text-[11px] text-muted-foreground/40 text-center">
            {t('garment.analyzed_at')} {new Date(garment.ai_analyzed_at).toLocaleDateString(getBCP47(locale))}
          </p>
        )}
      </div>
    </div>
  );
}
