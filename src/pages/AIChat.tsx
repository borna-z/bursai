import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, MoreVertical, Trash2 } from 'lucide-react';
import { StylistReplyPlaceholder } from '@/components/ui/StylistReplyPlaceholder';
import { ChatPageSkeleton } from '@/components/ui/skeletons';
import { motion } from 'framer-motion';
import { PRESETS } from '@/lib/motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { useGarmentCount } from '@/hooks/useGarments';
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

type MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type Message = {
  role: 'user' | 'assistant';
  content: string | MultimodalPart[];
};

const STYLE_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/style_chat`;

function getTextContent(content: string | MultimodalPart[]): string {
  if (typeof content === 'string') return content;
  return content.filter(p => p.type === 'text').map(p => (p as { type: 'text'; text: string }).text).join(' ');
}

async function loadMessages(userId: string): Promise<Message[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages?user_id=eq.${userId}&mode=eq.stylist&order=created_at.asc&limit=100`,
    { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}` } }
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
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages`, {
    method: 'POST',
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(msgs.map(m => ({ user_id: userId, role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content), mode: 'stylist' }))),
  });
}

async function deleteHistory(userId: string, accessToken: string) {
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages?user_id=eq.${userId}&mode=eq.stylist`, {
    method: 'DELETE',
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
  });
}

const GARMENT_TAG_RE = /\[\[garment:([a-f0-9-]+)\]\]/gi;
const OUTFIT_TAG_RE = /\[\[outfit:([a-f0-9-,]+)\|[^\]]*\]\]/gi;

function extractGarmentIds(messages: Message[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    const text = getTextContent(m.content);
    let match: RegExpExecArray | null;
    GARMENT_TAG_RE.lastIndex = 0;
    while ((match = GARMENT_TAG_RE.exec(text)) !== null) ids.add(match[1]);
    OUTFIT_TAG_RE.lastIndex = 0;
    while ((match = OUTFIT_TAG_RE.exec(text)) !== null) {
      match[1].split(',').forEach(id => ids.add(id.trim()));
    }
  }
  return Array.from(ids);
}

export default function AIChat() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const createOutfit = useCreateOutfit();
  const { data: garmentCount } = useGarmentCount();

  const welcomeMessage: Message = { role: 'assistant', content: t('chat.welcome') };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingImage, setPendingImage] = useState<{ url: string; path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isWelcomeState = messages.length === 1 && messages[0].role === 'assistant' && !isStreaming;

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    loadMessages(user.id).then(msgs => {
      if (msgs.length > 0) setMessages(msgs);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [user]);

  const garmentIds = useMemo(() => extractGarmentIds(messages), [messages]);
  const { data: garmentsList } = useGarmentsByIds(garmentIds);
  const garmentMap = useMemo(() => {
    const map = new Map<string, import('@/hooks/useGarmentsByIds').GarmentBasic>();
    garmentsList?.forEach(g => map.set(g.id, g));
    return map;
  }, [garmentsList]);

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
    if ((!trimmed && !pendingImage) || isStreaming) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const welcomeText = t('chat.welcome');

    let userContent: string | MultimodalPart[];
    if (pendingImage) {
      const parts: MultimodalPart[] = [{ type: 'image_url', image_url: { url: pendingImage.url } }];
      if (trimmed) parts.push({ type: 'text', text: trimmed });
      else parts.push({ type: 'text', text: t('chat.image_default') });
      userContent = parts;
    } else { userContent = trimmed; }

    const userMsg: Message = { role: 'user', content: userContent };
    setInput(''); setPendingImage(null); setIsStreaming(true);

    const newMessages = [...messages.filter((m, i) => !(i === 0 && getTextContent(m.content) === welcomeText)), userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    let assistantContent = '';
    try {
      const resp = await fetch(STYLE_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMessages, locale }),
      });
      if (!resp.ok) { const errData = await resp.json().catch(() => ({ error: t('chat.unknown_error') })); throw new Error(errData.error || `HTTP ${resp.status}`); }
      if (!resp.body) throw new Error(t('chat.no_response'));

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'assistant') updated[lastIdx] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
      const assistantMsg: Message = { role: 'assistant', content: assistantContent };
      if (user && session) await persistMessages(user.id, [userMsg, assistantMsg], session.access_token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('chat.unknown_error');
      toast.error(`${t('chat.error')} ${msg}`);
      setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && getTextContent(m.content) === '')));
    } finally { setIsStreaming(false); }
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
  );
}
