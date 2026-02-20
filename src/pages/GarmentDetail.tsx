import { useNavigate, useParams } from 'react-router-dom';
import { Edit, Trash2, WashingMachine, Check, Loader2, ExternalLink, Calendar, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGarment, useUpdateGarment, useDeleteGarment, useMarkGarmentWorn } from '@/hooks/useGarments';
import { LazyImage } from '@/components/ui/lazy-image';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GarmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: garment, isLoading, refetch } = useGarment(id);
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  const markWorn = useMarkGarmentWorn();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="p-4 flex items-center justify-between">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="w-24 h-10 rounded-lg" />
          </div>
        </div>
        <Skeleton className="aspect-square max-w-lg mx-auto" />
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <Skeleton className="h-6 w-1/2" />
          <div className="flex gap-2"><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-6 w-16 rounded-full" /></div>
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader 
        title={garment.title} showBack
        actions={
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/wardrobe/${garment.id}/edit`)}>
              <Edit className="w-5 h-5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="w-5 h-5 text-destructive" /></Button>
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
        }
      />

      <div className="max-w-lg mx-auto">
        <LazyImage imagePath={garment.image_path} alt={garment.title} aspectRatio="square" className="w-full" />
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <div><p className="text-muted-foreground capitalize text-sm">{garment.subcategory || garment.category}</p></div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">{garment.color_primary}</Badge>
          {garment.color_secondary && <Badge variant="secondary" className="capitalize">{garment.color_secondary}</Badge>}
          {garment.pattern && garment.pattern !== 'solid' && <Badge variant="secondary" className="capitalize">{garment.pattern}</Badge>}
          {garment.material && <Badge variant="secondary" className="capitalize">{garment.material}</Badge>}
          {garment.fit && <Badge variant="secondary" className="capitalize">{garment.fit}</Badge>}
          {garment.season_tags?.map((season) => <Badge key={season} variant="outline" className="capitalize">{season}</Badge>)}
          {garment.formality && <Badge variant="outline">{t('garment.formality')} {garment.formality}/5</Badge>}
        </div>

        {garment.source_url && (
          <Card>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="truncate">{t('garment.imported')}</span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href={garment.source_url} target="_blank" rel="noopener noreferrer">{t('garment.open')}</a>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{garment.wear_count || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('garment.worn_count')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {garment.last_worn_at
                  ? new Date(garment.last_worn_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                  : t('garment.never_worn')}
              </p>
              <p className="text-xs text-muted-foreground">{t('garment.last_worn')}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WashingMachine className="w-5 h-5 text-muted-foreground" />
              <Label className="font-normal">{t('garment.in_laundry')}</Label>
            </div>
            <Switch checked={garment.in_laundry || false} onCheckedChange={handleToggleLaundry} disabled={updateGarment.isPending} />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={handleMarkWorn} disabled={markWorn.isPending}>
            {markWorn.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {t('garment.mark_worn')}
          </Button>
        </div>

        {garment.ai_analyzed_at && (
          <p className="text-xs text-muted-foreground text-center">
            {t('garment.analyzed_at')} {new Date(garment.ai_analyzed_at).toLocaleDateString(undefined)}
          </p>
        )}
      </div>
    </div>
  );
}
