import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, Star, Calendar, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useOutfits, useDeleteOutfit, type OutfitWithItems } from '@/hooks/useOutfits';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { PlannedOutfitsList } from '@/components/outfit/PlannedOutfitsList';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

function OutfitCard({ outfit, onDelete, showPlannedDate, t }: { 
  outfit: OutfitWithItems; 
  onDelete: (id: string) => void;
  showPlannedDate?: boolean;
  t: (key: string) => string;
}) {
  const navigate = useNavigate();
  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); };
  const plannedFor = (outfit as any).planned_for;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-all overflow-hidden active:scale-[0.99] animate-burs-in opacity-0 [animation-fill-mode:both]" onClick={() => navigate(`/outfits/${outfit.id}`)}>
      <div className="flex h-24 bg-muted/30">
        {outfit.outfit_items.slice(0, 4).map((item, index) => (
          <div key={item.id} className={cn("flex-1 overflow-hidden", index < outfit.outfit_items.slice(0, 4).length - 1 && "border-r border-background")}>
            <LazyImageSimple imagePath={item.garment?.image_path} alt={item.garment?.title || item.slot} className="w-full h-full" />
          </div>
        ))}
        {outfit.outfit_items.length > 4 && (
          <div className="w-12 flex items-center justify-center bg-muted/50 text-xs text-muted-foreground">+{outfit.outfit_items.length - 4}</div>
        )}
      </div>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize text-xs">{outfit.occasion}</Badge>
              {outfit.rating && (
                <div className="flex items-center gap-0.5 text-sm text-muted-foreground">
                  <Star className="w-3 h-3 fill-primary text-primary" />{outfit.rating}
                </div>
              )}
            </div>
            {outfit.explanation && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{outfit.explanation}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {showPlannedDate && plannedFor && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(plannedFor), 'd MMM')}</span>
              )}
              {!showPlannedDate && outfit.worn_at && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(outfit.worn_at), 'd MMM')}</span>
              )}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('outfits.delete_confirm')}</AlertDialogTitle>
                <AlertDialogDescription>{t('outfits.delete_warning')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete(outfit.id)}>
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OutfitsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: outfits, isLoading } = useOutfits(false);
  const deleteOutfit = useDeleteOutfit();
  const [activeTab, setActiveTab] = useState('recent');

  const handleDeleteOutfit = (id: string) => {
    deleteOutfit.mutate(id, {
      onSuccess: () => { toast.success(t('outfits.deleted')); },
      onError: () => { toast.error(t('outfits.delete_error')); },
    });
  };

  const { recentOutfits, savedOutfits, plannedOutfits } = useMemo(() => {
    if (!outfits) return { recentOutfits: [], savedOutfits: [], plannedOutfits: [] };
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const planned = outfits.filter((o: any) => o.planned_for && o.planned_for >= today);
    const saved = outfits.filter(o => o.saved);
    const recent = [...outfits].sort((a, b) => new Date(b.generated_at || 0).getTime() - new Date(a.generated_at || 0).getTime()).slice(0, 10);
    return { recentOutfits: recent, savedOutfits: saved, plannedOutfits: planned };
  }, [outfits]);

  return (
    <AppLayout>
      <PageHeader title={t('outfits.title')} actions={
        <Button size="sm" onClick={() => navigate('/')}>
          <Sparkles className="w-4 h-4 mr-1.5" />{t('outfits.new')}
        </Button>
      } />
      
      <div className="px-4 pb-6 pt-4 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : outfits && outfits.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="recent" className="text-sm">{t('outfits.recent')}</TabsTrigger>
              <TabsTrigger value="saved" className="text-sm">{t('outfits.saved')} ({savedOutfits.length})</TabsTrigger>
              <TabsTrigger value="planned" className="text-sm">{t('outfits.planned')} ({plannedOutfits.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="recent" className="space-y-3 mt-0 stagger-burs">
              {recentOutfits.length > 0 ? recentOutfits.map((outfit) => (
                <OutfitCard key={outfit.id} outfit={outfit} onDelete={handleDeleteOutfit} t={t} />
              )) : (
                <EmptyState icon={Sparkles} title={t('outfits.no_outfits')} description={t('outfits.create_first')} action={{ label: t('outfits.create'), onClick: () => navigate('/'), icon: Sparkles }} />
              )}
            </TabsContent>
            <TabsContent value="saved" className="space-y-3 mt-0 stagger-burs">
              {savedOutfits.length > 0 ? savedOutfits.map((outfit) => (
                <OutfitCard key={outfit.id} outfit={outfit} onDelete={handleDeleteOutfit} t={t} />
              )) : (
                <EmptyState icon={Star} title={t('outfits.no_saved')} description={t('outfits.save_hint')} />
              )}
            </TabsContent>
            <TabsContent value="planned" className="mt-0">
              <PlannedOutfitsList outfits={plannedOutfits} onDelete={handleDeleteOutfit} />
            </TabsContent>
          </Tabs>
        ) : (
          <EmptyState icon={Sparkles} title={t('outfits.no_outfits')} description={t('outfits.no_outfits_ai')} action={{ label: t('outfits.create'), onClick: () => navigate('/'), icon: Sparkles }} />
        )}
      </div>
    </AppLayout>
  );
}
