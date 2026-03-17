import { useState } from 'react';
import { Link2, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { useLanguage } from '@/contexts/LanguageContext';

const MAX_LINKS = 30;

type LinkStatus = 'waiting' | 'importing' | 'success' | 'failed';

interface LinkItem {
  url: string;
  status: LinkStatus;
  error?: string;
  garmentTitle?: string;
}

export function LinkImportForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { canAddGarment, subscription, isPremium } = useSubscription();
  
  const [linksText, setLinksText] = useState('');
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showFailedDetails, setShowFailedDetails] = useState(false);

  const parseLinks = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
  };

  const parsedLinks = parseLinks(linksText);
  const linkCount = parsedLinks.length;
  const isOverMax = linkCount > MAX_LINKS;

  const currentCount = subscription?.garments_count || 0;
  const maxAllowed = isPremium ? Infinity : PLAN_LIMITS.free.maxGarments;
  const canAddCount = Math.max(0, maxAllowed - currentCount);
  const wouldExceedLimit = !isPremium && linkCount > canAddCount;

  const handleImport = async () => {
    if (!user || linkCount === 0 || isOverMax) return;

    if (!canAddGarment()) {
      setShowPaywall(true);
      return;
    }

    const linksToImport = isPremium 
      ? parsedLinks.slice(0, MAX_LINKS) 
      : parsedLinks.slice(0, Math.min(canAddCount, MAX_LINKS));

    if (linksToImport.length === 0) {
      setShowPaywall(true);
      return;
    }

    const initialItems: LinkItem[] = linksToImport.map(url => ({
      url,
      status: 'waiting' as LinkStatus,
    }));
    setLinkItems(initialItems);
    setIsImporting(true);
    setCurrentIndex(0);

    let successCount = 0;
    let failedCount = 0;
    const updatedItems = [...initialItems];

    for (let i = 0; i < linksToImport.length; i++) {
      setCurrentIndex(i);
      updatedItems[i] = { ...updatedItems[i], status: 'importing' };
      setLinkItems([...updatedItems]);

      try {
        const { data, error } = await supabase.functions.invoke('import_garments_from_links', {
          body: { 
            userId: user.id, 
            urls: [linksToImport[i]] 
          },
        });

        if (error) {
          throw new Error(error.message || t('import.failed'));
        }

        const result = data?.results?.[0];
        if (result?.status === 'ok') {
          updatedItems[i] = { 
            ...updatedItems[i], 
            status: 'success',
            garmentTitle: result.title || t('import.garment_imported'),
          };
          successCount++;
        } else {
          throw new Error(result?.reason || t('import.unknown_error'));
        }
      } catch (err: unknown) {
        updatedItems[i] = { 
          ...updatedItems[i], 
          status: 'failed',
          error: err instanceof Error ? err.message : t('import.could_not_import'),
        };
        failedCount++;
      }

      setLinkItems([...updatedItems]);
    }

    setIsImporting(false);

    queryClient.invalidateQueries({ queryKey: ['garments'] });
    queryClient.invalidateQueries({ queryKey: ['garment-count'] });
    queryClient.invalidateQueries({ queryKey: ['subscription'] });

    if (successCount > 0) {
      toast.success(t('import.success').replace('{count}', String(successCount)), {
        action: {
          label: t('import.show_wardrobe'),
          onClick: () => navigate('/wardrobe'),
        },
      });
    }

    if (failedCount > 0) {
      toast.error(t('import.failed_count').replace('{count}', String(failedCount)), {
        description: t('import.tap_details'),
        action: {
          label: t('import.show_details'),
          onClick: () => setShowFailedDetails(true),
        },
      });
    }
  };

  const getStatusIcon = (status: LinkStatus) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'importing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const getStatusLabel = (status: LinkStatus) => {
    switch (status) {
      case 'waiting': return t('import.status.waiting');
      case 'importing': return t('import.status.importing');
      case 'success': return t('import.status.success');
      case 'failed': return t('import.status.failed');
    }
  };

  const getStatusVariant = (status: LinkStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'waiting': return 'outline';
      case 'importing': return 'secondary';
      case 'success': return 'default';
      case 'failed': return 'destructive';
    }
  };

  const progressPercent = linkItems.length > 0 
    ? Math.round(((currentIndex + 1) / linkItems.length) * 100)
    : 0;

  const failedItems = linkItems.filter(item => item.status === 'failed');
  const importCount = Math.min(linkCount, isPremium ? MAX_LINKS : canAddCount);

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="links-input" className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            {t('import.paste_links')}
          </Label>
          <span className={`text-sm ${isOverMax ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {linkCount}/{MAX_LINKS} {t('import.links_count')}
          </span>
        </div>
        <Textarea
          id="links-input"
          placeholder="https://www.example.com/product-1&#10;https://www.example.com/product-2&#10;…"
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          disabled={isImporting}
          className="min-h-[160px] font-mono text-sm"
        />
        {isOverMax && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {t('import.max_links').replace('{max}', String(MAX_LINKS))}
          </p>
        )}
        {wouldExceedLimit && !isOverMax && (
          <p className="text-sm text-amber-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {t('import.free_limit').replace('{count}', String(canAddCount))}
            {linkCount > canAddCount && ` ${t('import.free_limit_only').replace('{count}', String(canAddCount))}`}
          </p>
        )}
      </div>

      {/* Info Box */}
      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-muted-foreground">
          {t('import.site_block')}
        </AlertDescription>
      </Alert>

      {/* Import Button */}
      <Button
        className="w-full"
        size="lg"
        onClick={handleImport}
        disabled={linkCount === 0 || isOverMax || isImporting}
      >
        {isImporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t('import.importing_progress').replace('{current}', String(currentIndex + 1)).replace('{total}', String(linkItems.length))}
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4 mr-2" />
            {linkCount > 0 ? t('import.import_links').replace('{count}', String(importCount)) : t('import.import_button')}
          </>
        )}
      </Button>

      {/* Progress Section */}
      {linkItems.length > 0 && (
        <div className="space-y-3">
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t('import.importing')}</span>
                <span className="text-muted-foreground">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} />
            </div>
          )}

          <div className="rounded-md border p-3 space-y-2">
              {linkItems.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {getStatusIcon(item.status)}
                    <span className="text-sm truncate">
                      {item.garmentTitle || new URL(item.url).hostname}
                    </span>
                  </div>
                  <Badge variant={getStatusVariant(item.status)} className="shrink-0">
                    {getStatusLabel(item.status)}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Failed Details Modal */}
      {showFailedDetails && failedItems.length > 0 && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <XCircle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">{t('import.failed_imports')}</p>
              <ul className="text-sm space-y-1">
                {failedItems.map((item, index) => (
                  <li key={index} className="flex flex-col">
                    <span className="truncate text-muted-foreground">{item.url}</span>
                    <span className="text-destructive text-xs">{item.error}</span>
                  </li>
                ))}
              </ul>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFailedDetails(false)}
              >
                {t('common.close')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="garments"
      />
    </div>
  );
}
