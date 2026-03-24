import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, MoreVertical, Trash2, Shirt, X } from 'lucide-react';
import { StylistReplyPlaceholder } from '@/components/ui/StylistReplyPlaceholder';
import { ChatPageSkeleton } from '@/components/ui/skeletons';
import { motion } from 'framer-motion';
import { PRESETS } from '@/lib/motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { createSupabaseRestHeaders, getSupabaseFunctionUrl, getSupabaseRestUrl, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentsByIds, type GarmentBasic } from '@/hooks/useGarmentsByIds';
import { useGarmentCount } from '@/hooks/useGarments';
import { useStyleDNA } from '@/hooks/useStyleDNA';
import { useCreateOutfit } from '@/hooks/useOutfits';
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
import { extractGarmentIdsFromText, parseOutfitTags } from '@/lib/garmentTokens';
import { getTextContent, mergeAssistantContent, type MessageContent, type MultimodalPart } from '@/lib/chatStream';

type Message = {
  role: 'user' | 'assistant';
  content: MessageContent;
};

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


function findLatestActiveLookMessageIndex(messages: Message[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;
    const text = getTextContent(message.content);
    return parseOutfitTags(text).length > 0 ? index : -1;
  }

  return -1;
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

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingImage, setPendingImage] = useState<{ url: string; path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [anchoredGarmentId, setAnchoredGarmentId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeStreamControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);

  const isWelcomeState = messages.length === 1 && messages[0].role === 'assistant' && !isStreaming;

  useEffect(() => {
    const state = location.state as { selectedGarmentId?: string; outfitId?: string; mood?: string } | null;
    const garmentId = state?.selectedGarmentId ?? null;
    if (garmentId) {
      setAnchoredGarmentId(garmentId);
    }
    if (state?.outfitId) {
      const moodLabel = state.mood ? ` (${state.mood} mood)` : '';
      setInput(`I just generated a mood outfit${moodLabel}. Can you help me refine it?`);
    }
    if (garmentId || state?.outfitId) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

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

  const garmentIds = useMemo(() => anchoredGarmentId ? Array.from(new Set([anchoredGarmentId, ...extractGarmentIds(messages)])) : extractGarmentIds(messages), [anchoredGarmentId, messages]);
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
      console.error(err);
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
          selected_garment_ids: anchoredGarmentId ? [anchoredGarmentId] : undefined,
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
      const msg = isAbort
        ? 'Stylist response timed out. Please try again.'
        : err instanceof Error
          ? err.message
          : t('chat.unknown_error');
      toast.error(`${t('chat.error')} ${msg}`);
      setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && getTextContent(m.content) === '')));
    } finally {
      if (streamTimeoutId) clearTimeout(streamTimeoutId);
      if (activeRequestIdRef.current === requestId) {
        activeStreamControllerRef.current = null;
        setIsStreaming(false);
      }
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await deleteHistory(user.id, session.access_token);
      setMessages([welcomeMessage]);
      toast.success(t('chat.history_cleared'));
    } catch { toast.error(t('chat.history_error')); }
  };

  const handleTryOutfit = useCallback(async (garmentIds: string[]) => {
    if (!garmentIds.length) return;
    try {
      const SLOT_ORDER = ['top', 'bottom', 'shoes', 'outerwear', 'accessory'];
      const items = garmentIds.map((id, i) => {
        const garment = garmentMap.get(id);
        const slot = garment?.category && SLOT_ORDER.includes(garment.category)
          ? garment.category
          : SLOT_ORDER[i] || 'top';
        return { garment_id: id, slot };
      });
      const result = await createOutfit.mutateAsync({
        outfit: { occasion: 'vardag', explanation: t('chat.outfit_from_stylist') },
        items,
      });
      navigate(`/outfits/${result.id}`);
      toast.success(t('outfit.created') || 'Outfit created!');
    } catch {
      toast.error(t('outfit.create_error') || 'Could not create outfit');
    }
  }, [garmentMap, createOutfit, navigate, t]);

  return (
    <PageErrorBoundary fallback={<AIChatFallback />}>
    <AppLayout>
      <div className="absolute inset-0 flex flex-col overflow-hidden pb-20">
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

        {anchoredGarment && (
          <div className="px-4 pb-2">
            <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-left shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
                  <Shirt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/70">Style anchor</p>
                  <p className="truncate text-sm font-medium text-foreground">{anchoredGarment.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl px-2.5 text-xs text-muted-foreground"
                  onClick={() => navigate(`/wardrobe/${anchoredGarment.id}`)}
                >
                  Change
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground"
                  onClick={() => setAnchoredGarmentId(null)}
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
