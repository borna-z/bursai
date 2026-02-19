import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, BarChart3, Trash2, ImagePlus, Sparkles, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { GarmentInlineCard } from '@/components/chat/GarmentInlineCard';

type MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type Message = {
  role: 'user' | 'assistant';
  content: string | MultimodalPart[];
};

type ChatMode = 'stylist' | 'shopping';

const STYLE_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/style_chat`;
const SHOPPING_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopping_chat`;

function getTextContent(content: string | MultimodalPart[]): string {
  if (typeof content === 'string') return content;
  return content.filter(p => p.type === 'text').map(p => (p as { type: 'text'; text: string }).text).join(' ');
}

function getImageUrls(content: string | MultimodalPart[]): string[] {
  if (typeof content === 'string') return [];
  return content.filter(p => p.type === 'image_url').map(p => (p as { type: 'image_url'; image_url: { url: string } }).image_url.url);
}

async function loadMessages(userId: string, mode: ChatMode): Promise<Message[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages?user_id=eq.${userId}&mode=eq.${mode}&order=created_at.asc&limit=100`,
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

async function persistMessages(userId: string, msgs: Message[], accessToken: string, mode: ChatMode) {
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages`, {
    method: 'POST',
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(msgs.map(m => ({ user_id: userId, role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content), mode }))),
  });
}

async function deleteMessagesByMode(userId: string, accessToken: string, mode: ChatMode) {
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages?user_id=eq.${userId}&mode=eq.${mode}`, {
    method: 'DELETE',
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
  });
}

export default function AIChat() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<ChatMode>('stylist');

  const stylistWelcome: Message = { role: 'assistant', content: t('chat.welcome') };
  const shoppingWelcome: Message = { role: 'assistant', content: t('chat.shopping_welcome') };

  const [stylistMessages, setStylistMessages] = useState<Message[]>([stylistWelcome]);
  const [shoppingMessages, setShoppingMessages] = useState<Message[]>([shoppingWelcome]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingImage, setPendingImage] = useState<{ url: string; path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = mode === 'stylist' ? stylistMessages : shoppingMessages;
  const setMessages = mode === 'stylist' ? setStylistMessages : setShoppingMessages;
  const welcomeMessage = mode === 'stylist' ? stylistWelcome : shoppingWelcome;
  const chatUrl = mode === 'stylist' ? STYLE_CHAT_URL : SHOPPING_CHAT_URL;

  // Load messages for both modes on mount
  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    Promise.all([
      loadMessages(user.id, 'stylist'),
      loadMessages(user.id, 'shopping'),
    ]).then(([sMsgs, shMsgs]) => {
      if (sMsgs.length > 0) setStylistMessages(sMsgs);
      if (shMsgs.length > 0) setShoppingMessages(shMsgs);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [user]);

  // Fetch garment data for inline cards
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

  const sendMessage = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !pendingImage) || isStreaming) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const welcomeText = mode === 'stylist' ? t('chat.welcome') : t('chat.shopping_welcome');

    let userContent: string | MultimodalPart[];
    if (pendingImage) {
      const parts: MultimodalPart[] = [{ type: 'image_url', image_url: { url: pendingImage.url } }];
      if (trimmed) parts.push({ type: 'text', text: trimmed });
      else parts.push({ type: 'text', text: mode === 'shopping' ? t('chat.shopping_placeholder') : t('chat.image_default') });
      userContent = parts;
    } else { userContent = trimmed; }

    const userMsg: Message = { role: 'user', content: userContent };
    setInput(''); setPendingImage(null); setIsStreaming(true);

    const newMessages = [...messages.filter((m, i) => !(i === 0 && getTextContent(m.content) === welcomeText)), userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    let assistantContent = '';
    try {
      const resp = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMessages }),
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
      if (user && session) await persistMessages(user.id, [userMsg, assistantMsg], session.access_token, mode);
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
      await deleteMessagesByMode(user.id, session.access_token, mode);
      setMessages([welcomeMessage]);
      toast.success(t('chat.history_cleared'));
    } catch { toast.error(t('chat.history_error')); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const modeSwitcher = (
    <div className="flex bg-muted rounded-lg p-0.5">
      <button
        onClick={() => setMode('stylist')}
        className={cn(
          'flex items-center gap-1 py-1.5 px-2.5 rounded-md text-xs font-medium transition-all',
          mode === 'stylist'
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {t('chat.mode_stylist')}
      </button>
      <button
        onClick={() => setMode('shopping')}
        className={cn(
          'flex items-center gap-1 py-1.5 px-2.5 rounded-md text-xs font-medium transition-all',
          mode === 'shopping'
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <ShoppingBag className="w-3.5 h-3.5" />
        {t('chat.mode_shopping')}
      </button>
    </div>
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      {modeSwitcher}
      <Link to="/insights">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-accent" title={t('chat.insights')}>
          <BarChart3 className="w-5 h-5" />
        </Button>
      </Link>
      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={clearHistory} title={t('chat.clear_history')}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  const placeholder = mode === 'shopping'
    ? (pendingImage ? t('chat.image_placeholder') : t('chat.shopping_placeholder'))
    : (pendingImage ? t('chat.image_placeholder') : t('chat.placeholder'));

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>
        <PageHeader title={t('chat.title')} actions={headerActions} />

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-36">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            messages.map((msg, idx) => (
              <MessageBubble key={`${mode}-${idx}`} message={msg} isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant' && getTextContent(msg.content) === ''} garmentMap={garmentMap} isShopping={mode === 'shopping'} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="fixed bottom-16 left-0 right-0 border-t bg-background/95 backdrop-blur-md px-4 py-3">
          {pendingImage && (
            <div className="max-w-lg mx-auto mb-2 relative inline-block">
              <img src={pendingImage.url} alt="" className="h-20 w-20 object-cover rounded-lg border border-border" />
              <button onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold">×</button>
            </div>
          )}
          <div className="flex items-end gap-2 max-w-lg mx-auto">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isStreaming || isUploading} title={t('chat.upload_image')}>
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            </Button>
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="min-h-[44px] max-h-32 resize-none text-sm" disabled={isStreaming} rows={1} />
            <Button onClick={sendMessage} disabled={(!input.trim() && !pendingImage) || isStreaming} size="icon" className="h-11 w-11 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5">{t('chat.disclaimer')}</p>
        </div>
      </div>
    </AppLayout>
  );
}

const GARMENT_TAG_RE = /\[\[garment:([a-f0-9-]+)\]\]/gi;

function extractGarmentIds(messages: Message[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    const text = getTextContent(m.content);
    let match: RegExpExecArray | null;
    GARMENT_TAG_RE.lastIndex = 0;
    while ((match = GARMENT_TAG_RE.exec(text)) !== null) {
      ids.add(match[1]);
    }
  }
  return Array.from(ids);
}

function MessageBubble({ message, isStreaming, garmentMap, isShopping }: { message: Message; isStreaming: boolean; garmentMap: Map<string, import('@/hooks/useGarmentsByIds').GarmentBasic>; isShopping?: boolean }) {
  const isUser = message.role === 'user';
  const text = getTextContent(message.content);
  const images = getImageUrls(message.content);

  const renderContent = useMemo(() => {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const re = /\[\[garment:([a-f0-9-]+)\]\]/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`t-${lastIndex}`} className="whitespace-pre-wrap leading-relaxed">{text.slice(lastIndex, match.index)}</span>);
      }
      const garment = garmentMap.get(match[1]);
      if (garment) {
        parts.push(<GarmentInlineCard key={`g-${match[1]}-${match.index}`} garment={garment} />);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={`t-${lastIndex}`} className="whitespace-pre-wrap leading-relaxed">{text.slice(lastIndex)}</span>);
    }
    return parts;
  }, [text, garmentMap]);

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 shrink-0">
          {isShopping ? <ShoppingBag className="w-4 h-4 text-accent" /> : <Sparkles className="w-4 h-4 text-accent" />}
        </div>
      )}
      <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 text-sm', isUser ? 'bg-accent text-accent-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm')}>
        {images.length > 0 && (
          <div className="mb-2 flex gap-2 flex-wrap">
            {images.map((url, i) => <img key={i} src={url} alt="Outfit" className="h-32 w-32 object-cover rounded-lg" />)}
          </div>
        )}
        {isStreaming ? (
          <span className="inline-flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          renderContent
        )}
      </div>
    </div>
  );
}
