import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, MoreVertical, Trash2, Shirt, X } from 'lucide-react';
import { StylistReplyPlaceholder } from '@/components/ui/StylistReplyPlaceholder';
import { ChatPageSkeleton } from '@/components/ui/skeletons';
import { motion } from 'framer-motion';
import { PRESETS } from '@/lib/motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { StyleMeSubNav } from '@/components/ai/StyleMeSubNav';
import { createSupabaseRestHeaders, getSupabaseFunctionUrl, getSupabaseRestUrl, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentsByIds, type GarmentBasic } from '@/hooks/useGarmentsByIds';
import { useGarmentCount } from '@/hooks/useGarments';
import { logger } from '@/lib/logger';
import { useStyleDNA } from '@/hooks/useStyleDNA';
import { useCreateOutfit, useOutfit } from '@/hooks/useOutfits';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatWelcome } from '@/components/chat/ChatWelcome';
import { ChatInput } from '@/components/chat/ChatInput';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { PageErrorBoundary } from '@/components/layout/PageErrorBoundary';
import { extractGarmentIdsFromText } from '@/lib/garmentTokens';
import { getTextContent, mergeAssistantContent, type MessageContent, type MultimodalPart } from '@/lib/chatStream';
import {
  buildStyleFlowSearch,
  extractStyleFlowGarmentIds,
  extractStyleFlowSeedOutfitIds,
  extractStyleFlowOutfitId,
  extractStyleFlowPrefillMessage,
  resolveStyleFlowGarmentIds,
} from '@/lib/styleFlowState';
import { findLatestActiveLookMessageIndex } from '@/lib/chatActiveLook';
import { resolveCompleteOutfitIds } from '@/lib/completeOutfitIds';
import { inferOutfitSlotFromGarment, validateCompleteOutfit } from '@/lib/outfitValidation';

type Message = {
  role: 'user' | 'assistant';
  content: MessageContent;
};

interface PlanActionPayload {
  mode: string;
  calendar_days: Array<{ date: string; [key: string]: unknown }>;
  can_plan: boolean;
}

const STYLE_CHAT_URL = getSupabaseFunctionUrl('style_chat');

async function loadMessages(userId: string): Promise<Message[]> {
  const res = await fetch(
    `${getSupabaseRestUrl('chat_messages')}?user_id=eq.${userId}&mode=eq.stylist&order=created_at.asc&limit=100`,
    { headers: await createSupabaseRestHeaders() }
  );
  if (!res.ok) return [];
  const rows = await res.json() as { role: 'user' | 'assistant'; content: string }[];
  return rows.map(r => {
    if (r.content.startsWith('[')) {
      try { const parsed = JSON.parse(r.content); if (Array.isArray(parsed)) return { role: r.role, content: parsed }; } catch { /* fallback */ }
    }
    return { role: r.role, content: r.content };
  });
}

async function persistMessages(userId: string, msgs: Message[], accessToken: string) {
  await fetch(getSupabaseRestUrl('chat_messages'), {
    method: 'POST',
    headers: { ...(await createSupabaseRestHeaders(accessToken)), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(msgs.map(m => ({ user_id: userId, role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content), mode: 'stylist' }))),
  });
}

async function deleteHistory(userId: string, accessToken: string) {
  await fetch(`${getSupabaseRestUrl('chat_messages')}?user_id=eq.${userId}&mode=eq.stylist`, {
    method: 'DELETE',
    headers: await createSupabaseRestHeaders(accessToken),
  });
}

function extractGarmentIds(messages: Message[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    extractGarmentIdsFromText(getTextContent(m.content)).forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

function buildRequestMessages(messages: Message[]): Message[] {
  const filtered = messages.filter((message, index) => {
    const text = getTextContent(message.content).trim();
    if (!text && typeof message.content === 'string') return false;
    if (index === 0 && message.role === 'assistant') return false;
    return true;
  });

  return filtered.slice(-16);
}

function hasSameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function buildSeedOutfitMessage(garmentIds: string[]): Message {
  return {
    role: 'assistant',
    content: `Current look to refine: [[outfit:${garmentIds.join(',')}|Current look]]`,
  };
}

function hasSeedOutfitMessage(messages: Message[], garmentIds: string[]): boolean {
  const seedPrefix = `[[outfit:${garmentIds.join(',')}|`;
  return messages.some((message) => message.role === 'assistant' && getTextContent(message.content).includes(seedPrefix));
}

function AIChatFallback() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Your stylist is temporarily unavailable</h1>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    </div>
  );
}

export default function AIChat() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const createOutfit = useCreateOutfit();
  const { data: garmentCount } = useGarmentCount();
  const { data: styleDNA } = useStyleDNA();

  const welcomeMessage: Message = { role: 'assistant', content: t('chat.welcome') };

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem('burs_chat_history');
      return saved ? JSON.parse(saved) : [welcomeMessage];
    } catch {
      return [welcomeMessage];
    }
  });
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(null);
  const [pendingSeedOutfitIds, setPendingSeedOutfitIds] = useState<string[] | null>(null);
  const [pendingImage, setPendingImage] = useState<{ url: string; path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedGarmentIds, setSelectedGarmentIds] = useState<string[]>([]);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [planActionPayload, setPlanActionPayload] = useState<PlanActionPayload | null>(null);
  const [suggestionChips, setSuggestionChips] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeStreamControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const sendMessageRef = useRef<(text?: string) => Promise<void>>(async () => {});
  const anchoredGarmentId = selectedGarmentIds[0] ?? null;

  const isWelcomeState = messages.length === 1 && messages[0].role === 'assistant' && !isStreaming;

  useEffect(() => {
    const stateGarmentIds = extractStyleFlowGarmentIds(location.state);
    const garmentIds = resolveStyleFlowGarmentIds(location.search, location.state);
    const outfitId = extractStyleFlowOutfitId(location.state);
    const prefill = extractStyleFlowPrefillMessage(location.state);
    const seedOutfitIds = extractStyleFlowSeedOutfitIds(location.state);

    setSelectedGarmentIds((prev) => hasSameIds(prev, garmentIds) ? prev : garmentIds);
    setSelectedOutfitId(outfitId);
    if (prefill) setPendingPrefill(prefill);
    setPendingSeedOutfitIds(seedOutfitIds.length >= 2 ? seedOutfitIds : null);
    if (location.state) {
      const nextSearch = location.search || buildStyleFlowSearch(stateGarmentIds);
      navigate(`${location.pathname}${nextSearch}`, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => () => {
    activeStreamControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    loadMessages(user.id).then(msgs => {
      if (msgs.length > 0) setMessages(msgs);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [user]);

  const { data: selectedOutfit } = useOutfit(selectedOutfitId || undefined, 'allow_generated_base');

  useEffect(() => {
    if (!selectedOutfit) return;
    const outfitGarmentIds = selectedOutfit.outfit_items
      .map((item) => item.garment_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (outfitGarmentIds.length > 0) {
      setSelectedGarmentIds((prev) => hasSameIds(prev, outfitGarmentIds) ? prev : outfitGarmentIds);
      setPendingSeedOutfitIds((prev) => prev && hasSameIds(prev, outfitGarmentIds) ? prev : outfitGarmentIds);
      const nextSearch = buildStyleFlowSearch(outfitGarmentIds);
      if (nextSearch && nextSearch !== location.search) {
        navigate(`${location.pathname}${nextSearch}`, { replace: true });
      }
    }
  }, [location.pathname, location.search, navigate, selectedOutfit]);

  useEffect(() => {
    if (!pendingSeedOutfitIds || pendingSeedOutfitIds.length < 2 || isLoading) return;
    if (!pendingSeedOutfitIds.every((id) => garmentMap.has(id))) return;

    const completeSeedOutfitIds = resolveCompleteOutfitIds(pendingSeedOutfitIds, garmentMap);
    if (completeSeedOutfitIds.length === 0) {
      setPendingSeedOutfitIds(null);
      return;
    }

    setMessages((prev) => {
      if (hasSeedOutfitMessage(prev, completeSeedOutfitIds)) return prev;
      return [...prev, buildSeedOutfitMessage(completeSeedOutfitIds)];
    });
    setPendingSeedOutfitIds(null);
  }, [garmentMap, isLoading, pendingSeedOutfitIds]);

  const garmentIds = useMemo(
    () => Array.from(new Set([...selectedGarmentIds, ...extractGarmentIds(messages)])),
    [messages, selectedGarmentIds],
  );
  const { data: garmentsList } = useGarmentsByIds(garmentIds);
  const garmentMap = useMemo(() => {
    const map = new Map<string, GarmentBasic>();
    garmentsList?.forEach(g => map.set(g.id, g));
    return map;
  }, [garmentsList]);

  const anchoredGarment = useMemo(() => anchoredGarmentId ? garmentMap.get(anchoredGarmentId) ?? null : null, [anchoredGarmentId, garmentMap]);
  const latestActiveLookMessageIndex = useMemo(() => findLatestActiveLookMessageIndex(messages), [messages]);

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem('burs_chat_history', JSON.stringify(messages));
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `${user.id}/chat/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('garments').upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: signedData } = await supabase.storage.from('garments').createSignedUrl(storagePath, 3600);
      if (!signedData?.signedUrl) throw new Error('Could not create signed URL');
      setPendingImage({ url: signedData.signedUrl, path: storagePath });
    } catch (err) {
      toast.error(t('chat.upload_error'));
      logger.error(err);
    } finally { setIsUploading(false); }
  };

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if ((!trimmed && !pendingImage) || isStreaming || activeStreamControllerRef.current) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error(t('chat.error') + ' ' + (t('common.please_login') || 'Please log in again.'));
      setIsStreaming(false);
      return;
    }
    const token = session.access_token;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    let userContent: string | MultimodalPart[];
    if (pendingImage) {
      const parts: MultimodalPart[] = [{ type: 'image_url', image_url: { url: pendingImage.url } }];
      if (trimmed) parts.push({ type: 'text', text: trimmed });
      else parts.push({ type: 'text', text: t('chat.image_default') });
      userContent = parts;
    } else {
      userContent = trimmed;
    }

    const userMsg: Message = { role: 'user', content: userContent };
    setInput('');
    setPendingImage(null);
    setPlanActionPayload(null);
    setSuggestionChips([]);
    setIsStreaming(true);

    const welcomeText = t('chat.welcome');
    const baseMessages = messages.filter((m, i) => !(i === 0 && getTextContent(m.content) === welcomeText));
    const newMessages = [...baseMessages, userMsg];
    const requestMessages = buildRequestMessages(newMessages);
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    let assistantContent: MessageContent = '';
    let sawDone = false;
    let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const controller = new AbortController();
      activeStreamControllerRef.current = controller;
      const resetStreamTimeout = () => {
        if (streamTimeoutId) clearTimeout(streamTimeoutId);
        streamTimeoutId = setTimeout(() => controller.abort(), 45000);
      };
      resetStreamTimeout();

      const resp = await fetch(STYLE_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: requestMessages,
          locale,
          garmentCount: garmentCount ?? 0,
          archetype: styleDNA?.archetype ?? null,
          selected_garment_ids: selectedGarmentIds.length > 0 ? selectedGarmentIds : undefined,
        }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: t('chat.unknown_error') }));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }
      if (!resp.body) throw new Error(t('chat.no_response'));

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamClosed = false;

      while (!streamClosed) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          streamClosed = true;
        } else {
          buffer += decoder.decode(value, { stream: true });
        }

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            sawDone = true;
            continue;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'plan_action' && parsed.payload?.can_plan) {
              setPlanActionPayload(parsed.payload as PlanActionPayload);
            }
            if (parsed.type === 'suggestions' && Array.isArray(parsed.chips)) {
              setSuggestionChips(parsed.chips as string[]);
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta != null) resetStreamTimeout();
            const nextAssistantContent = mergeAssistantContent(assistantContent, delta);
            if (nextAssistantContent !== assistantContent) {
              assistantContent = nextAssistantContent;
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'assistant') updated[lastIdx] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            if (!streamClosed) {
              buffer = line + '\n' + buffer;
              break;
            }
          }
        }
      }

      if (!sawDone && !getTextContent(assistantContent).trim()) {
        throw new Error(t('chat.no_response'));
      }

      const assistantMsg: Message = { role: 'assistant', content: assistantContent };
      if (user && session && getTextContent(assistantMsg.content).trim()) {
        await persistMessages(user.id, [userMsg, assistantMsg], session.access_token);
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      // Show a graceful in-chat fallback instead of just a toast + blank space
      const fallbackText = isAbort
        ? (t('chat.stylist_timeout') || 'I lost my train of thought — could you try that again?')
        : (t('chat.stylist_fallback') || 'Something went wrong on my end. Try asking again or rephrase your request.');
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = { role: 'assistant', content: fallbackText };
        }
        return updated;
      });
    } finally {
      if (streamTimeoutId) clearTimeout(streamTimeoutId);
      if (activeRequestIdRef.current === requestId) {
        activeStreamControllerRef.current = null;
        setIsStreaming(false);
      }
    }
  };

  // Keep ref in sync so the auto-send effect can call the latest sendMessage
  sendMessageRef.current = sendMessage;

  // Auto-send a message pre-filled from navigation state (e.g. Today screen suggestion chips)
  useEffect(() => {
    if (!pendingPrefill || isLoading || pendingSeedOutfitIds !== null) return;
    const msg = pendingPrefill;
    setPendingPrefill(null);
    sendMessageRef.current(msg);
  }, [pendingPrefill, isLoading, pendingSeedOutfitIds]);

  const clearHistory = async () => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await deleteHistory(user.id, session.access_token);
      sessionStorage.removeItem('burs_chat_history');
      setMessages([welcomeMessage]);
      toast.success(t('chat.history_cleared'));
    } catch { toast.error(t('chat.history_error')); }
  };

  const handleTryOutfit = useCallback(async (garmentIds: string[]) => {
    if (!garmentIds.length) return;
    try {
      const items = garmentIds.map((id) => {
        const garment = garmentMap.get(id);
        return garment
          ? { garment_id: id, slot: inferOutfitSlotFromGarment(garment), garment }
          : null;
      }).filter(Boolean) as Array<{ garment_id: string; slot: string; garment: GarmentBasic }>;

      if (items.length !== garmentIds.length) {
        toast.error(t('outfit.create_error') || 'Could not create outfit');
        return;
      }

      const validation = validateCompleteOutfit(items.map((item) => ({
        slot: item.slot,
        garment: item.garment,
      })));
      if (!validation.isValid) {
        toast.error(t('outfit.create_error') || 'Could not create outfit', {
          description: validation.missing.length > 0 ? `Missing: ${validation.missing.join(', ')}` : undefined,
        });
        return;
      }
      const result = await createOutfit.mutateAsync({
        outfit: { occasion: 'vardag', explanation: t('chat.outfit_from_stylist') },
        items: items.map(({ garment_id, slot }) => ({ garment_id, slot })),
      });
      navigate(`/outfits/${result.id}`);
      toast.success(t('outfit.created') || 'Outfit created!');
    } catch {
      toast.error(t('outfit.create_error') || 'Could not create outfit');
    }
  }, [garmentMap, createOutfit, navigate, t]);

  const handleAddToPlan = useCallback((payload: PlanActionPayload) => {
    navigate('/plan', { state: { planningMode: true, calendar_days: payload.calendar_days } });
  }, [navigate]);

  return (
    <PageErrorBoundary fallback={<AIChatFallback />}>
    <AppLayout>
      <div className="absolute inset-0 flex flex-col overflow-hidden pb-20">
        <StyleMeSubNav />
        {/* Header — simple title + menu */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
          <div className="w-9" />
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-[15px] font-semibold">{t('chat.mode_stylist')}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={clearHistory} className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {t('chat.clear_history')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Wardrobe context badge */}
        {garmentCount != null && garmentCount > 0 && (
          <div className="px-4 pb-1">
            <p className="text-[11px] text-muted-foreground/40 text-center">
              {t('chat.based_on')} {garmentCount} {t('chat.garments_label')}
            </p>
          </div>
        )}

        {(anchoredGarment || selectedGarmentIds.length > 0) && (
          <div className="px-4 pb-2">
            <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-left shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
                  <Shirt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/70">
                    {selectedGarmentIds.length > 1 ? 'Current look' : 'Style anchor'}
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {anchoredGarment?.title || 'Selected wardrobe pieces'}
                    {selectedGarmentIds.length > 1 ? ` +${selectedGarmentIds.length - 1} more` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl px-2.5 text-xs text-muted-foreground"
                  onClick={() => {
                    if (selectedOutfitId) {
                      navigate(`/outfits/${selectedOutfitId}`);
                      return;
                    }
                    if (anchoredGarment) navigate(`/wardrobe/${anchoredGarment.id}`);
                  }}
                >
                  {selectedOutfitId ? 'View' : 'Change'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground"
                  onClick={() => {
                    setSelectedGarmentIds([]);
                    setSelectedOutfitId(null);
                    setPendingSeedOutfitIds(null);
                    navigate(location.pathname, { replace: true });
                  }}
                  aria-label="Clear garment anchor"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Messages or Welcome */}
        {isLoading ? (
          <ChatPageSkeleton />
        ) : isWelcomeState ? (
          <ChatWelcome onSuggestion={sendMessage} garmentCount={garmentCount ?? undefined} />
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6 space-y-8">
            {messages.map((msg, idx) => {
              if (idx === 0 && msg.role === 'assistant' && !isStreaming) {
                if (getTextContent(msg.content) === t('chat.welcome')) return null;
              }
              const isStreamingMsg = isStreaming && idx === messages.length - 1 && msg.role === 'assistant';
              const isEmpty = getTextContent(msg.content) === '';
              return (
                <motion.div
                  key={idx}
                  variants={PRESETS.MESSAGE.variants}
                  initial="initial"
                  animate="animate"
                  transition={PRESETS.MESSAGE.transition}
                >
                  {isStreamingMsg && isEmpty ? (
                    <StylistReplyPlaceholder />
                  ) : (
                    <ChatMessage
                      message={msg}
                      isStreaming={isStreamingMsg}
                      garmentMap={garmentMap}
                      onTryOutfit={handleTryOutfit}
                      isCreatingOutfit={createOutfit.isPending}
                      showStyleCards={msg.role !== 'assistant' || idx === latestActiveLookMessageIndex || isStreamingMsg}
                    />
                  )}
                </motion.div>
              );
            })}
            {/* Plan action banner */}
            {planActionPayload && !isStreaming && (
              <div style={{
                background: '#1C1917', borderRadius: 12, padding: 16, marginTop: 12,
              }}>
                <p style={{
                  fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                  fontSize: 14, color: 'rgba(245,240,232,0.75)', marginBottom: 12,
                }}>
                  Your week is planned. Add these looks to the planner?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { handleAddToPlan(planActionPayload); setPlanActionPayload(null); }}
                    style={{
                      flex: 1, background: '#F5F0E8', color: '#1C1917', border: 'none',
                      borderRadius: 8, padding: '8px 0', fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    Add to plan
                  </button>
                  <button
                    onClick={() => setPlanActionPayload(null)}
                    style={{
                      flex: 1, background: 'transparent', color: 'rgba(245,240,232,0.5)',
                      border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 14,
                      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {/* Suggestion chips — always-present 44px container to prevent layout jump */}
            <div style={{ height: 44, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
              {suggestionChips.length > 0 && !isStreaming && input === '' && (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  paddingLeft: 16,
                  paddingRight: 16,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}>
                  {suggestionChips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSuggestionChips([]);
                        sendMessage(chip);
                      }}
                      style={{
                        background: '#F5F0E8',
                        color: '#1C1917',
                        border: '1px solid rgba(28,25,23,0.20)',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: 13,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        <ChatInput
          input={input}
          onInputChange={setInput}
          onSend={() => sendMessage()}
          onImageSelect={handleImageSelect}
          pendingImage={pendingImage}
          onClearImage={() => setPendingImage(null)}
          isStreaming={isStreaming}
          isUploading={isUploading}
        />
        <div className="pb-2 shrink-0" />
      </div>
    </AppLayout>
    </PageErrorBoundary>
  );
}
