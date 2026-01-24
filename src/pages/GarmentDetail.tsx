import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, WashingMachine, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useGarment, useUpdateGarment, useDeleteGarment, useMarkGarmentWorn } from '@/hooks/useGarments';
import { useGarmentSignedUrl } from '@/hooks/useStorage';

export default function GarmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: garment, isLoading } = useGarment(id);
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  const markWorn = useMarkGarmentWorn();
  const { signedUrl: imageUrl, isLoading: imageLoading } = useGarmentSignedUrl(garment?.image_path);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!garment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg font-medium">Plagget hittades inte</p>
        <Button variant="link" onClick={() => navigate('/wardrobe')}>
          Tillbaka till garderoben
        </Button>
      </div>
    );
  }

  const handleToggleLaundry = async () => {
    try {
      await updateGarment.mutateAsync({
        id: garment.id,
        updates: { in_laundry: !garment.in_laundry },
      });
      toast.success(garment.in_laundry ? 'Plagget är nu tillgängligt' : 'Plagget är nu i tvätten');
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleMarkWorn = async () => {
    try {
      await markWorn.mutateAsync(garment.id);
      toast.success('Markerat som använt idag ✓');
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGarment.mutateAsync(garment.id);
      toast.success('Plagget har tagits bort');
      navigate('/wardrobe');
    } catch {
      toast.error('Något gick fel');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/wardrobe/${garment.id}/edit`)}
            >
              <Edit className="w-5 h-5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Radera plagg?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Är du säker på att du vill radera "{garment.title}"? Detta går inte att ångra.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Radera
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="aspect-square bg-secondary">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={garment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-muted" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{garment.title}</h1>
          <p className="text-muted-foreground capitalize">{garment.category}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {garment.subcategory && (
            <Badge variant="secondary">{garment.subcategory}</Badge>
          )}
          <Badge variant="secondary" className="capitalize">{garment.color_primary}</Badge>
          {garment.color_secondary && (
            <Badge variant="secondary" className="capitalize">{garment.color_secondary}</Badge>
          )}
          {garment.pattern && (
            <Badge variant="secondary" className="capitalize">{garment.pattern}</Badge>
          )}
          {garment.material && (
            <Badge variant="secondary" className="capitalize">{garment.material}</Badge>
          )}
          {garment.fit && (
            <Badge variant="secondary" className="capitalize">{garment.fit}</Badge>
          )}
          {garment.season_tags?.map((season) => (
            <Badge key={season} variant="outline" className="capitalize">
              {season}
            </Badge>
          ))}
          <Badge variant="outline">Formalitet: {garment.formality}/5</Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground">Använt</p>
            <p className="text-2xl font-bold">{garment.wear_count || 0}</p>
            <p className="text-sm text-muted-foreground">gånger</p>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground">Senast använd</p>
            <p className="text-lg font-medium">
              {garment.last_worn_at
                ? new Date(garment.last_worn_at).toLocaleDateString('sv-SE')
                : 'Aldrig'}
            </p>
          </div>
        </div>

        {/* Laundry Toggle */}
        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
          <div className="flex items-center gap-2">
            <WashingMachine className="w-5 h-5 text-muted-foreground" />
            <Label>I tvätt</Label>
          </div>
          <Switch
            checked={garment.in_laundry || false}
            onCheckedChange={handleToggleLaundry}
            disabled={updateGarment.isPending}
          />
        </div>

        {/* Mark as Worn */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleMarkWorn}
          disabled={markWorn.isPending}
        >
          {markWorn.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Markera som använd idag
        </Button>
      </div>
    </div>
  );
}
