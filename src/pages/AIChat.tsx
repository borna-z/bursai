import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Loader2, BarChart3, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/style_chat`;

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: 'Hej! Jag är din personliga stylist. Jag är här för att hjälpa dig klä dig med stil och självförtroende. Berätta lite om dig själv – vad jobbar du med, och vilka tillfällen klär du dig för oftast?',
};

async function loadMessages(userId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .rpc('has_role' as never, {} as never) // dummy call to satisfy TS, real call below
    .then(() => ({ data: null, error: null }));
  
  // Directly query via REST-style since types don't include chat_messages yet
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
  return rows.map(r => ({ role: r.role, content: r.content }));
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
      body: JSON.stringify(msgs.map(m => ({ user_id: userId, role: m.role, content: m.content }))),
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setInput('');
    setIsStreaming(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Optimistically add user message
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

      // Save to backend
      const assistantMsg: Message = { role: 'assistant', content: assistantContent };
      if (user && session) {
        await persistMessages(user.id, [userMsg, assistantMsg], session.access_token);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel';
      toast.error(`Stylisten svarade inte. ${msg}`);
      setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && m.content === '')));
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
        <PageHeader title="Stylisten" actions={headerActions} />

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
                isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant' && msg.content === ''}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="fixed bottom-16 left-0 right-0 border-t bg-background/95 backdrop-blur-md px-4 py-3">
          <div className="flex items-end gap-2 max-w-lg mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Skriv till din stylist..."
              className="min-h-[44px] max-h-32 resize-none text-sm"
              disabled={isStreaming}
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
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

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
          <Bot className="w-4 h-4 text-primary" />
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
        {isStreaming ? (
          <span className="inline-flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}
      </div>
    </div>
  );
}
