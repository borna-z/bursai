import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, BarChart3, Trash2, ImagePlus } from 'lucide-react';
import { DrapeLogo } from '@/components/ui/DrapeLogo';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type Message = {
  role: 'user' | 'assistant';
  content: string | MultimodalPart[];
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/style_chat`;

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: 'Hej! Jag är DRAPE Stylisten – din personliga AI-stylist. Jag är här för att hjälpa dig klä dig med stil och självförtroende. Du kan skicka mig bilder på dina outfits så ger jag dig feedback! 📸',
};

function getTextContent(content: string | MultimodalPart[]): string {
  if (typeof content === 'string') return content;
  return content.filter(p => p.type === 'text').map(p => (p as { type: 'text'; text: string }).text).join(' ');
}

function getImageUrls(content: string | MultimodalPart[]): string[] {
  if (typeof content === 'string') return [];
  return content
    .filter(p => p.type === 'image_url')
    .map(p => (p as { type: 'image_url'; image_url: { url: string } }).image_url.url);
}

async function loadMessages(userId: string): Promise<Message[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages?user_id=eq.${userId}&order=created_at.asc&limit=100`,
    {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
      },
    }
  );
  if (!res.ok) return [];
  const rows = await res.json() as { role: 'user' | 'assistant'; content: string }[];
  return rows.map(r => {
    // Try to parse multimodal JSON content
    if (r.content.startsWith('[')) {
      try {
        const parsed = JSON.parse(r.content);
        if (Array.isArray(parsed)) return { role: r.role, content: parsed };
      } catch { /* fallback to string */ }
    }
    return { role: r.role, content: r.content };
  });
}

async function persistMessages(userId: string, msgs: Message[], accessToken: string) {
  await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages`,
    {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(msgs.map(m => ({
        user_id: userId,
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }))),
    }
  );
}

async function deleteAllMessages(userId: string, accessToken: string) {
  await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_messages?user_id=eq.${userId}`,
    {
      method: 'DELETE',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

export default function AIChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingImage, setPendingImage] = useState<{ url: string; path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    loadMessages(user.id).then(msgs => {
      if (msgs.length > 0) setMessages(msgs);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [user]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = ''; // reset input

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `${user.id}/chat/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('garments')
        .upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from('garments')
        .createSignedUrl(storagePath, 3600);
      if (!signedData?.signedUrl) throw new Error('Could not create signed URL');

      setPendingImage({ url: signedData.signedUrl, path: storagePath });
    } catch (err) {
      toast.error('Kunde inte ladda upp bilden');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !pendingImage) || isStreaming) return;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Build multimodal content if image is attached
    let userContent: string | MultimodalPart[];
    if (pendingImage) {
      const parts: MultimodalPart[] = [
        { type: 'image_url', image_url: { url: pendingImage.url } },
      ];
      if (trimmed) parts.push({ type: 'text', text: trimmed });
      else parts.push({ type: 'text', text: 'Vad tycker du om denna outfit?' });
      userContent = parts;
    } else {
      userContent = trimmed;
    }

    const userMsg: Message = { role: 'user', content: userContent };
    setInput('');
    setPendingImage(null);
    setIsStreaming(true);

    const newMessages = [...messages.filter(m => m !== WELCOME_MESSAGE || messages.length > 1), userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    let assistantContent = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: 'Okänt fel' }));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error('Inget svar');

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
                if (updated[lastIdx]?.role === 'assistant') {
                  updated[lastIdx] = { role: 'assistant', content: assistantContent };
                }
                return updated;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      const assistantMsg: Message = { role: 'assistant', content: assistantContent };
      if (user && session) {
        await persistMessages(user.id, [userMsg, assistantMsg], session.access_token);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel';
      toast.error(`Stylisten svarade inte. ${msg}`);
      setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && getTextContent(m.content) === '')));
    } finally {
      setIsStreaming(false);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await deleteAllMessages(user.id, session.access_token);
      setMessages([WELCOME_MESSAGE]);
      toast.success('Konversationshistorik rensad');
    } catch {
      toast.error('Kunde inte rensa historik');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Link to="/insights">
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Insikter">
          <BarChart3 className="w-5 h-5" />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        onClick={clearHistory}
        title="Rensa historik"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>
        <PageHeader title="DRAPE Stylisten" actions={headerActions} />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-36">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                message={msg}
                isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant' && getTextContent(msg.content) === ''}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="fixed bottom-16 left-0 right-0 border-t bg-background/95 backdrop-blur-md px-4 py-3">
          {/* Pending image preview */}
          {pendingImage && (
            <div className="max-w-lg mx-auto mb-2 relative inline-block">
              <img
                src={pendingImage.url}
                alt="Uppladdad bild"
                className="h-20 w-20 object-cover rounded-lg border border-border"
              />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 max-w-lg mx-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
              title="Ladda upp bild"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ImagePlus className="w-5 h-5" />
              )}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingImage ? "Beskriv din outfit (valfritt)..." : "Skriv till din stylist..."}
              className="min-h-[44px] max-h-32 resize-none text-sm"
              disabled={isStreaming}
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={(!input.trim() && !pendingImage) || isStreaming}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5">
            AI-stylist · Råd är personliga, inte professionella
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming: boolean }) {
  const isUser = message.role === 'user';
  const text = getTextContent(message.content);
  const images = getImageUrls(message.content);

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0 overflow-hidden">
          <DrapeLogo variant="icon" size="sm" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        )}
      >
        {/* Inline images */}
        {images.length > 0 && (
          <div className="mb-2 flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="Outfit"
                className="h-32 w-32 object-cover rounded-lg"
              />
            ))}
          </div>
        )}
        {isStreaming ? (
          <span className="inline-flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  );
}
