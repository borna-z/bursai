import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessagesSquare, MoreVertical, Plus, Shirt, Trash2, X } from 'lucide-react';
import { StylistReplyPlaceholder } from '@/components/ui/StylistReplyPlaceholder';
import { ChatPageSkeleton } from '@/components/ui/skeletons';
import { motion, AnimatePresence } from 'framer-motion';
import { PRESETS } from '@/lib/motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { getSupabaseFunctionUrl, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentsByIds, type GarmentBasic } from '@/hooks/useGarmentsByIds';
import { useGarmentCount } from '@/hooks/useGarments';
import { hapticLight } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { useStyleDNA } from '@/hooks/useStyleDNA';
import { useCreateOutfit } from '@/hooks/useOutfits';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatWelcome } from '@/components/chat/ChatWelcome';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatHistorySheet, type ChatThreadSummary } from '@/components/chat/ChatHistorySheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { PageErrorBoundary } from '@/components/layout/PageErrorBoundary';
import { extractGarmentIdsFromText } from '@/lib/garmentTokens';
import { finalizeAssistantText, getTextContent, mergeAssistantContent, type MessageContent, type MultimodalPart } from '@/lib/chatStream';
import { inferOutfitSlotFromGarment, validateBaseOutfit } from '@/lib/outfitValidation';
import { useRefineMode } from '@/hooks/useRefineMode';
import { RefineChips } from '@/components/chat/RefineChips';
import { RefineBanner } from '@/components/chat/RefineBanner';
import { resolveStyleFlowLocationState } from '@/lib/styleFlowState';
import { getLatestActiveLook, hasRenderableActiveLook } from '@/lib/chatActiveLook';
import { trackEvent } from '@/lib/analytics';
import { collectStyleChatGarmentIds, isStyleChatResponseEnvelope, type PersistedStyleChatMessage, type StyleChatResponseEnvelope } from '@/lib/styleChatContract';

type Message = {
  role: 'user' | 'assistant';
  content: MessageContent;
  stylistMeta?: StyleChatResponseEnvelope | null;
};

interface PlanActionPayload {
  mode: string;
  calendar_days: Array<{ date: string; [key: string]: unknown }>;
  can_plan: boolean;
}

const STYLE_CHAT_URL = getSupabaseFunctionUrl('style_chat');
const DEFAULT_CHAT_MODE = 'stylist';
const CHAT_HISTORY_KEY = 'burs_chat_history';
const CHAT_THREAD_META_KEY = 'burs_chat_thread_meta';
const CHAT_OWNER_KEY = 'burs_chat_owner';
const ANONYMOUS_CHAT_OWNER = '__anon__';
const ACTIVE_CHAT_MODE_KEY = 'burs_active_chat_mode';
const CHAT_THREAD_PREFIX = `${DEFAULT_CHAT_MODE}:`;
const THREAD_FETCH_LIMIT = 500;

type StoredMessageRow = {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  mode: string;
};

function parseStoredMessageContent(content: string): MessageContent {
  if (content.startsWith('[')) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed as MessageContent;
    } catch {
      // Fall through to plain string content.
    }
  }

  return content;
}

function parseStoredMessage(row: { role: 'user' | 'assistant'; content: string }): Message {
  if (row.content.startsWith('{')) {
    try {
      const parsed = JSON.parse(row.content) as PersistedStyleChatMessage;
      if (parsed?.kind === 'stylist_message') {
        return {
          role: row.role,
          content: parsed.content,
          stylistMeta: isStyleChatResponseEnvelope(parsed.stylistMeta) ? parsed.stylistMeta : null,
        };
      }
    } catch {
      // Fall through to legacy parsing.
    }
  }

  return {
    role: row.role,
    content: parseStoredMessageContent(row.content),
  };
}

function getSessionHistoryKey(mode: string): string {
  return mode === DEFAULT_CHAT_MODE ? CHAT_HISTORY_KEY : `${CHAT_HISTORY_KEY}:${mode}`;
}

function purgeChatSessionStorage() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (
        key === CHAT_HISTORY_KEY
        || key.startsWith(`${CHAT_HISTORY_KEY}:`)
        || key === CHAT_THREAD_META_KEY
        || key === ACTIVE_CHAT_MODE_KEY
      ) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore storage errors
  }
}

function ensureChatSessionOwner(ownerId: string): boolean {
  try {
    const current = sessionStorage.getItem(CHAT_OWNER_KEY);
    if (current && current !== ownerId) {
      purgeChatSessionStorage();
    }
    if (current !== ownerId) {
      sessionStorage.setItem(CHAT_OWNER_KEY, ownerId);
    }
    return current !== null && current !== ownerId;
  } catch {
    return false;
  }
}

function readActiveChatMode(): string {
  try {
    return sessionStorage.getItem(ACTIVE_CHAT_MODE_KEY) || DEFAULT_CHAT_MODE;
  } catch {
    return DEFAULT_CHAT_MODE;
  }
}

function createChatThreadMode(): string {
  return `${CHAT_THREAD_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readThreadMeta(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(CHAT_THREAD_META_KEY);
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function writeThreadMeta(mode: string, updatedAt = new Date().toISOString()) {
  try {
    const meta = readThreadMeta();
    sessionStorage.setItem(CHAT_THREAD_META_KEY, JSON.stringify({ ...meta, [mode]: updatedAt }));
  } catch {
    // ignore storage errors
  }
}

function clearThreadMeta(mode: string) {
  try {
    const meta = readThreadMeta();
    delete meta[mode];
    sessionStorage.setItem(CHAT_THREAD_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage errors
  }
}

function readSessionMessages(defaultMessages: Message[], mode = DEFAULT_CHAT_MODE): Message[] {
  try {
    const saved = sessionStorage.getItem(getSessionHistoryKey(mode));
    return saved ? JSON.parse(saved) as Message[] : defaultMessages;
  } catch {
    return defaultMessages;
  }
}

function hasConversationMessages(messages: Message[]): boolean {
  return messages.some((message, index) => {
    if (message.role === 'user') return true;
    if (hasRenderableActiveLook(message.stylistMeta)) return true;
    return index > 0 && getTextContent(message.content).trim().length > 0;
  });
}

function writeSessionMessages(messages: Message[], mode: string) {
  try {
    sessionStorage.setItem(getSessionHistoryKey(mode), JSON.stringify(messages));
    sessionStorage.setItem(ACTIVE_CHAT_MODE_KEY, mode);
    if (hasConversationMessages(messages)) writeThreadMeta(mode);
  } catch {
    // ignore quota errors
  }
}

function clearSessionMessages(mode: string) {
  try {
    sessionStorage.removeItem(getSessionHistoryKey(mode));
    clearThreadMeta(mode);
  } catch {
    // ignore storage errors
  }
}

function compactThreadText(text: string, max = 72): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}...`;
}

function getSessionModeFromHistoryKey(key: string): string | null {
  if (key === CHAT_HISTORY_KEY) return DEFAULT_CHAT_MODE;
  const prefix = `${CHAT_HISTORY_KEY}:`;
  if (!key.startsWith(prefix)) return null;
  const mode = key.slice(prefix.length);
  if (mode === DEFAULT_CHAT_MODE || mode.startsWith(CHAT_THREAD_PREFIX)) return mode;
  return null;
}

function inferStoragePathFromSignedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = '/storage/v1/object/sign/garments/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

async function refreshImageParts(content: MessageContent): Promise<MessageContent> {
  if (typeof content === 'string') return content;

  const refreshedParts = await Promise.all(content.map(async (part) => {
    if (part.type !== 'image_url') return part;

    const storagePath = part.storage_path ?? inferStoragePathFromSignedUrl(part.image_url.url);
    if (!storagePath) return part;

    const { data, error } = await supabase.storage
      .from('garments')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) return { ...part, storage_path: storagePath };

    return {
      ...part,
      storage_path: storagePath,
      image_url: { url: data.signedUrl },
    };
  }));

  return refreshedParts;
}

async function hydrateMessages(messages: Message[]): Promise<Message[]> {
  return Promise.all(messages.map(async (message) => ({
    ...message,
    content: await refreshImageParts(message.content),
  })));
}

function buildThreadSummaries(rows: StoredMessageRow[]): ChatThreadSummary[] {
  const grouped = new Map<string, StoredMessageRow[]>();
  rows.forEach((row) => {
    const mode = row.mode || DEFAULT_CHAT_MODE;
    if (mode !== DEFAULT_CHAT_MODE && !mode.startsWith(CHAT_THREAD_PREFIX)) return;
    const list = grouped.get(mode) ?? [];
    list.push(row);
    grouped.set(mode, list);
  });

  return Array.from(grouped.entries())
    .map(([mode, threadRows]) => {
      const sorted = threadRows.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const parsedRows = sorted.map((row) => ({ row, message: parseStoredMessage(row) }));
      const firstUser = parsedRows.find((entry) => entry.message.role === 'user');
      const lastWithText = parsedRows.slice().reverse().find((entry) => getTextContent(entry.message.content).trim().length > 0);
      const titleText = firstUser ? getTextContent(firstUser.message.content) : '';
      const previewText = lastWithText ? getTextContent(lastWithText.message.content) : '';
      const latestRow = sorted[sorted.length - 1];

      return {
        mode,
        title: compactThreadText(titleText, 44),
        preview: compactThreadText(previewText, 96),
        updatedAt: latestRow?.created_at ?? new Date(0).toISOString(),
        messageCount: sorted.length,
        hasOutfit: parsedRows.some((entry) => hasRenderableActiveLook(entry.message.stylistMeta)),
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function buildSessionThreadSummary(mode: string, messages: Message[], updatedAt: string): ChatThreadSummary | null {
  if (!hasConversationMessages(messages)) return null;

  const firstUser = messages.find((message) => message.role === 'user');
  const lastWithText = messages.slice().reverse().find((message) => getTextContent(message.content).trim().length > 0);
  const titleText = firstUser ? getTextContent(firstUser.content) : '';
  const previewText = lastWithText ? getTextContent(lastWithText.content) : '';
  const messageCount = messages.filter((message, index) => (
    message.role === 'user'
    || hasRenderableActiveLook(message.stylistMeta)
    || (index > 0 && getTextContent(message.content).trim().length > 0)
  )).length;

  return {
    mode,
    title: compactThreadText(titleText, 44),
    preview: compactThreadText(previewText, 96),
    updatedAt,
    messageCount,
    hasOutfit: messages.some((message) => hasRenderableActiveLook(message.stylistMeta)),
  };
}

function readSessionThreadSummaries(): ChatThreadSummary[] {
  const summaries: ChatThreadSummary[] = [];
  const meta = readThreadMeta();

  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      const mode = getSessionModeFromHistoryKey(key);
      if (!mode) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;

      try {
        const messages = JSON.parse(raw) as Message[];
        // Missing meta -> epoch 0 so remote summaries win in mergeThreadSummaries.
        const summary = buildSessionThreadSummary(mode, messages, meta[mode] ?? new Date(0).toISOString());
        if (summary) summaries.push(summary);
      } catch {
        // Ignore malformed local drafts.
      }
    }
  } catch {
    return summaries;
  }

  return summaries;
}

function mergeThreadSummaries(remote: ChatThreadSummary[], local: ChatThreadSummary[]): ChatThreadSummary[] {
  const byMode = new Map<string, ChatThreadSummary>();

  remote.forEach((summary) => byMode.set(summary.mode, summary));
  local.forEach((summary) => {
    const existing = byMode.get(summary.mode);
    if (!existing || new Date(summary.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      byMode.set(summary.mode, summary);
    }
  });

  return Array.from(byMode.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function loadThreadSummaries(userId: string): Promise<ChatThreadSummary[]> {
  const { data } = await supabase
    .from('chat_messages')
    .select('role, content, created_at, mode')
    .eq('user_id', userId)
    .like('mode', `${DEFAULT_CHAT_MODE}%`)
    .order('created_at', { ascending: false })
    .limit(THREAD_FETCH_LIMIT);

  if (!data) return [];
  return buildThreadSummaries(data as StoredMessageRow[]);
}

async function loadMessages(userId: string, mode: string): Promise<Message[]> {
  const { data } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('created_at', { ascending: true })
    .limit(100);
  if (!data) return [];
  return (data as { role: 'user' | 'assistant'; content: string }[]).map((row) => parseStoredMessage(row));
}

async function persistMessages(userId: string, msgs: Message[], mode: string) {
  const { error } = await supabase
    .from('chat_messages')
    .insert(msgs.map(m => {
      const content = m.stylistMeta
        ? JSON.stringify({
          kind: 'stylist_message',
          content: m.content,
          stylistMeta: m.stylistMeta,
        } satisfies PersistedStyleChatMessage)
        : typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content);
      return { user_id: userId, role: m.role, content, mode };
    }));

  if (error) {
    logger.error(error);
  }
}

async function deleteHistory(userId: string, mode: string) {
  await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', userId)
    .eq('mode', mode);
}

function extractGarmentIds(messages: Message[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    extractGarmentIdsFromText(getTextContent(m.content)).forEach((id) => ids.add(id));
    collectStyleChatGarmentIds(m.stylistMeta).forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

function buildRequestMessages(messages: Message[]): Array<Pick<Message, 'role' | 'content'>> {
  const filtered = messages.filter((message, index) => {
    const text = getTextContent(message.content).trim();
    if (!text && typeof message.content === 'string') return false;
    if (index === 0 && message.role === 'assistant') return false;
    return true;
  });

  return filtered.slice(-10).map((message, index, list) => {
    const text = getTextContent(message.content);
    const keepFull = index >= list.length - 4;
    const compactText = !keepFull && text.length > 320
      ? `${text.slice(0, 317).trim()}...`
      : text;
    return {
      role: message.role,
      content: typeof message.content === 'string' ? compactText : message.content,
    };
  });
}

function AIChatFallback() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <h1 className="font-display italic text-[1.3rem] text-foreground leading-tight">{t('ai.stylist_unavailable')}</h1>
        <Button onClick={() => navigate(-1)}>{t('common.back') || 'Go Back'}</Button>
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

  const welcomeText = t('chat.welcome');
  const welcomeMessage = useMemo<Message>(() => ({ role: 'assistant', content: welcomeText }), [welcomeText]);

  const [activeChatMode, setActiveChatMode] = useState(() => readActiveChatMode());
  // Defer draft restoration to the auth-aware effect below so we don't leak
  // a previous user's drafts before ensureChatSessionOwner can purge them.
  const [messages, setMessages] = useState<Message[]>(() => [welcomeMessage]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [threadSummaries, setThreadSummaries] = useState<ChatThreadSummary[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [inputDockHeight, setInputDockHeight] = useState(104);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const isKeyboardOpen = keyboardInset > 20;
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ url: string; path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [anchoredGarmentId, setAnchoredGarmentId] = useState<string | null>(null);
  const [planActionPayload, setPlanActionPayload] = useState<PlanActionPayload | null>(null);
  const [suggestionChips, setSuggestionChips] = useState<string[]>([]);
  const [lastConfirmedLook, setLastConfirmedLook] = useState<StyleChatResponseEnvelope | null>(null);
  const [pendingLookUpdate, setPendingLookUpdate] = useState<StyleChatResponseEnvelope | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputDockRef = useRef<HTMLDivElement>(null);
  const activeStreamControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const activeChatModeRef = useRef(activeChatMode);
  const sendMessageRef = useRef<(text?: string) => Promise<void>>(async () => {});

  const refineMode = useRefineMode();
  const [savedOutfitIds, setSavedOutfitIds] = useState<Set<string>>(new Set());
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const savingRef = useRef(false);

  const isWelcomeState = messages.length === 1 && messages[0].role === 'assistant' && !isStreaming;

  useEffect(() => {
    const { selectedGarmentId: garmentId, prefillMessage: prefill } = resolveStyleFlowLocationState({
      search: location.search,
      state: location.state,
    });
    if (garmentId) setAnchoredGarmentId(garmentId);
    if (prefill) setPendingPrefill(prefill);
    if (garmentId || prefill) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => () => {
    activeStreamControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    activeChatModeRef.current = activeChatMode;
    try {
      sessionStorage.setItem(ACTIVE_CHAT_MODE_KEY, activeChatMode);
    } catch {
      // ignore storage errors
    }
  }, [activeChatMode]);

  const refreshThreadSummaries = useCallback(async () => {
    if (ensureChatSessionOwner(user?.id ?? ANONYMOUS_CHAT_OWNER)) {
      setActiveChatMode(DEFAULT_CHAT_MODE);
    }
    const localSummaries = readSessionThreadSummaries();
    if (!user) {
      setThreadSummaries(localSummaries);
      setIsLoadingThreads(false);
      return;
    }

    setIsLoadingThreads(true);
    try {
      const summaries = await loadThreadSummaries(user.id);
      setThreadSummaries(mergeThreadSummaries(summaries, localSummaries));
    } finally {
      setIsLoadingThreads(false);
    }
  }, [user]);

  useEffect(() => {
    refreshThreadSummaries();
  }, [refreshThreadSummaries]);

  useEffect(() => {
    setIsLoading(true);
    if (ensureChatSessionOwner(user?.id ?? ANONYMOUS_CHAT_OWNER) && activeChatMode !== DEFAULT_CHAT_MODE) {
      setActiveChatMode(DEFAULT_CHAT_MODE);
      return;
    }
    if (!user) {
      setMessages(readSessionMessages([welcomeMessage], activeChatMode));
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    const restoreMessages = async () => {
      const persistedMessages = await loadMessages(user.id, activeChatMode);
      const fallbackMessages = readSessionMessages([welcomeMessage], activeChatMode);
      const baseMessages = persistedMessages.length > 0 ? persistedMessages : fallbackMessages;
      const hydratedMessages = await hydrateMessages(baseMessages);

      if (cancelled) return;
      setMessages(hydratedMessages.length > 0 ? hydratedMessages : [welcomeMessage]);
      setIsLoading(false);
    };

    restoreMessages().catch(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeChatMode, user, welcomeMessage]);

  const garmentIds = useMemo(() => anchoredGarmentId ? Array.from(new Set([anchoredGarmentId, ...extractGarmentIds(messages)])) : extractGarmentIds(messages), [anchoredGarmentId, messages]);
  const { data: garmentsList } = useGarmentsByIds(garmentIds);
  const garmentMap = useMemo(() => {
    const map = new Map<string, GarmentBasic>();
    garmentsList?.forEach(g => map.set(g.id, g));
    return map;
  }, [garmentsList]);

  const anchoredGarment = useMemo(() => anchoredGarmentId ? garmentMap.get(anchoredGarmentId) ?? null : null, [anchoredGarmentId, garmentMap]);
  const latestActiveLook = useMemo(() => getLatestActiveLook(messages), [messages]);
  const currentVisibleLook = useMemo(
    () => pendingLookUpdate ?? lastConfirmedLook ?? latestActiveLook,
    [pendingLookUpdate, lastConfirmedLook, latestActiveLook],
  );

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Re-anchor to bottom only when the keyboard opens (viewport SHRINKS
  // significantly from the current baseline). Avoids forcing scroll on
  // chrome expand/collapse, orientation change, or other viewport events
  // that would yank users away from older messages they're reading.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let baseline = vv.height;
    const onResize = () => {
      const current = vv.height;
      if (current >= baseline - 10) {
        // Viewport grew back or stayed: reset baseline, no scroll
        baseline = Math.max(baseline, current);
        return;
      }
      if (baseline - current > 100) {
        // Significant shrink: keyboard opened
        scrollToBottom();
      }
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [scrollToBottom]);

  useEffect(() => {
    if (isStreaming) return;
    if (latestActiveLook && hasRenderableActiveLook(latestActiveLook)) {
      setLastConfirmedLook(latestActiveLook);
      return;
    }
    if (!messages.some((message) => message.role === 'assistant' && hasRenderableActiveLook(message.stylistMeta))) {
      setLastConfirmedLook(null);
    }
  }, [isStreaming, latestActiveLook, messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    writeSessionMessages(messages, activeChatModeRef.current);
  }, [messages]);

  useEffect(() => {
    const dock = inputDockRef.current;
    if (!dock) return;

    const updateHeight = () => setInputDockHeight(dock.getBoundingClientRect().height);
    updateHeight();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  // Pin the dock to the visual viewport bottom so iOS Safari doesn't leave a
  // keyboard-height gap between the composer and the soft keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(overlap);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

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
    const requestChatMode = activeChatMode;
    activeChatModeRef.current = requestChatMode;
    const canApplyRequestUpdate = () => (
      activeRequestIdRef.current === requestId
      && activeChatModeRef.current === requestChatMode
    );

    let userContent: string | MultimodalPart[];
    if (pendingImage) {
      const parts: MultimodalPart[] = [{ type: 'image_url', image_url: { url: pendingImage.url }, storage_path: pendingImage.path }];
      if (trimmed) parts.push({ type: 'text', text: trimmed });
      else parts.push({ type: 'text', text: t('chat.image_default') });
      userContent = parts;
    } else {
      userContent = trimmed;
    }

    const userMsg: Message = { role: 'user', content: userContent };
    trackEvent('stylist_chat_message_sent', { has_image: pendingImage !== null });
    setInput('');
    setPendingImage(null);
    setPlanActionPayload(null);
    setSuggestionChips([]);
    setPendingLookUpdate(null);
    setIsStreaming(true);

    const welcomeText = t('chat.welcome');
    const baseMessages = messages.filter((m, i) => !(i === 0 && getTextContent(m.content) === welcomeText));
    const newMessages = [...baseMessages, userMsg];
    const requestMessages = buildRequestMessages(newMessages);
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    let assistantContent: MessageContent = '';
    let assistantMeta: StyleChatResponseEnvelope | null = null;
    let sawDone = false;
    let sawTruncatedMetadata = false;
    let sawFirstDelta = false;
    let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const controller = new AbortController();
      activeStreamControllerRef.current = controller;
      const resetStreamTimeout = (timeoutMs: number) => {
        if (streamTimeoutId) clearTimeout(streamTimeoutId);
        streamTimeoutId = setTimeout(() => controller.abort(), timeoutMs);
      };
      resetStreamTimeout(90000);

      const resp = await fetch(STYLE_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: requestMessages,
          locale,
          garmentCount: garmentCount ?? 0,
          archetype: styleDNA?.archetype ?? null,
          selected_garment_ids: anchoredGarmentId ? [anchoredGarmentId] : undefined,
          locked_slots: refineMode.isRefining ? refineMode.lockedSlots : undefined,
          active_look: refineMode.isRefining
            ? {
              garment_ids: refineMode.activeGarmentIds,
              explanation: refineMode.activeExplanation,
              source: 'refine_mode',
              anchor_garment_id: anchoredGarmentId ?? null,
              anchor_locked: Boolean(anchoredGarmentId),
            }
            : currentVisibleLook
              ? {
                garment_ids: currentVisibleLook.active_look?.garment_ids?.length
                  ? currentVisibleLook.active_look.garment_ids
                  : currentVisibleLook.outfit_ids,
                explanation: currentVisibleLook.active_look?.explanation || currentVisibleLook.outfit_explanation,
                source: currentVisibleLook.active_look?.source || currentVisibleLook.active_look_status,
                anchor_garment_id: currentVisibleLook.active_look?.anchor_garment_id ?? anchoredGarmentId ?? null,
                anchor_locked: currentVisibleLook.active_look?.anchor_locked ?? Boolean(anchoredGarmentId),
              }
              : undefined,
        }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: t('chat.unknown_error') }));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }
      if (!resp.body) throw new Error(t('chat.no_response'));
      resetStreamTimeout(30000);

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
            if (!canApplyRequestUpdate()) return;
            if (parsed.type === 'stylist_response' && isStyleChatResponseEnvelope(parsed.payload)) {
              assistantMeta = parsed.payload;
              if (assistantMeta?.clear_active_look) {
                refineMode.exitRefineMode();
                setLastConfirmedLook(null);
                setPendingLookUpdate(null);
                setAnchoredGarmentId(null);
              }
              if (hasRenderableActiveLook(assistantMeta)) {
                setPendingLookUpdate(assistantMeta);
              }
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'assistant') {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    stylistMeta: assistantMeta,
                  };
                }
                return updated;
              });
            }
            if (parsed.type === 'plan_action' && parsed.payload?.can_plan) {
              setPlanActionPayload(parsed.payload as PlanActionPayload);
            }
            if (parsed.type === 'suggestions' && Array.isArray(parsed.chips)) {
              setSuggestionChips(parsed.chips as string[]);
            }
            if (parsed.type === 'metadata' && parsed.truncated) {
              sawTruncatedMetadata = true;
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta != null) {
              sawFirstDelta = true;
              resetStreamTimeout(20000);
            }
            const nextAssistantContent = mergeAssistantContent(assistantContent, delta);
            if (nextAssistantContent !== assistantContent) {
              assistantContent = nextAssistantContent;
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'assistant') {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    role: 'assistant',
                    content: assistantContent,
                    stylistMeta: assistantMeta ?? updated[lastIdx].stylistMeta ?? null,
                  };
                }
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

      if (!canApplyRequestUpdate()) return;

      if (!sawDone && !getTextContent(assistantContent).trim() && !assistantMeta?.assistant_text) {
        throw new Error(t('chat.no_response'));
      }

      const finalizedText = finalizeAssistantText(
        getTextContent(assistantContent).trim() || assistantMeta?.assistant_text || '',
        sawTruncatedMetadata,
      );
      const assistantMsg: Message = {
        role: 'assistant',
        content: finalizedText,
        stylistMeta: assistantMeta
          ? {
            ...assistantMeta,
            assistant_text: finalizedText || assistantMeta.assistant_text,
            truncated: assistantMeta.truncated || sawTruncatedMetadata,
          }
          : null,
      };
      if (hasRenderableActiveLook(assistantMsg.stylistMeta)) {
        setLastConfirmedLook(assistantMsg.stylistMeta);
      }
      // Guard: don't push refinement if clear_active_look was set during streaming
      // (exitRefineMode was already called but the stale closure still reads isRefining=true)
      if (refineMode.isRefining && !assistantMeta?.clear_active_look && assistantMeta?.active_look?.garment_ids?.length) {
        refineMode.pushRefinement(
          assistantMeta.active_look.garment_ids,
          assistantMeta.active_look.explanation ?? assistantMeta.outfit_explanation ?? '',
        );
      }
      setPendingLookUpdate(null);
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = assistantMsg;
        }
        return updated;
      });
      if (hasRenderableActiveLook(assistantMsg.stylistMeta)) {
        trackEvent('outfit_refined', { response_kind: assistantMsg.stylistMeta?.response_kind ?? null });
      }
      if (user && session && (getTextContent(assistantMsg.content).trim() || assistantMsg.stylistMeta?.render_outfit_card)) {
        await persistMessages(user.id, [userMsg, assistantMsg], requestChatMode);
        refreshThreadSummaries();
      }
    } catch (err) {
      if (!canApplyRequestUpdate()) return;
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const fallbackText = isAbort
        ? (t('chat.stylist_timeout') || 'I hit a delay, but I kept the current look live.')
        : (t('chat.stylist_fallback') || 'Something went wrong on my end. Try asking again or rephrase your request.');
      const preservedMeta = assistantMeta
        ?? (currentVisibleLook
          ? {
            ...currentVisibleLook,
            assistant_text: fallbackText,
            suggestion_chips: [],
            truncated: true,
            response_kind: 'style_repair',
            card_policy: currentVisibleLook.card_policy,
            card_state: currentVisibleLook.card_state === 'unavailable' ? 'unavailable' : 'preserved',
            fallback_used: true,
            degraded_reason: isAbort ? 'request_timeout' : 'request_failed',
            active_look_status: currentVisibleLook.outfit_ids.length > 0 ? 'preserved' : currentVisibleLook.active_look_status,
            active_look: currentVisibleLook.active_look?.garment_ids?.length
              ? {
                ...currentVisibleLook.active_look,
                status: currentVisibleLook.outfit_ids.length > 0 ? 'preserved' : currentVisibleLook.active_look.status,
                card_state: currentVisibleLook.outfit_ids.length > 0 ? 'preserved' : currentVisibleLook.active_look.card_state,
              }
              : currentVisibleLook.active_look,
          }
          : null);
      if (hasRenderableActiveLook(preservedMeta)) {
        setLastConfirmedLook(preservedMeta);
      }
      setPendingLookUpdate(null);
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = {
            role: 'assistant',
            content: finalizeAssistantText(
              getTextContent(assistantContent).trim() || fallbackText,
              true,
            ),
            stylistMeta: preservedMeta,
          };
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
    if (!pendingPrefill || isLoading) return;
    const msg = pendingPrefill;
    setPendingPrefill(null);
    sendMessageRef.current(msg);
  }, [pendingPrefill, isLoading]);

  const clearHistory = async () => {
    if (!user) return;
    // Abort any active stream first, then clear
    activeStreamControllerRef.current?.abort();
    activeStreamControllerRef.current = null;
    activeRequestIdRef.current += 1;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await deleteHistory(user.id, activeChatMode);
      clearSessionMessages(activeChatMode);
      setMessages([welcomeMessage]);
      setLastConfirmedLook(null);
      setPendingLookUpdate(null);
      setSuggestionChips([]);
      refineMode.exitRefineMode();
      setSavedOutfitIds(new Set());
      refreshThreadSummaries();
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

      const validation = validateBaseOutfit(
        items.map((item) => ({ slot: item.slot, garment: item.garment })),
      );
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

  const handleSaveFromChat = useCallback(async (garmentIds: string[]) => {
    // Use ref guard to prevent double-save on rapid taps (state may not
    // have updated between two taps within the same render frame)
    if (!user || savingRef.current) return;
    savingRef.current = true;
    setIsSavingOutfit(true);
    try {
      const items = garmentIds.map((id) => {
        const garment = garmentMap.get(id);
        const slot = garment ? inferOutfitSlotFromGarment(garment) : 'top';
        return { garment_id: id, slot };
      });
      await createOutfit.mutateAsync({
        outfit: {
          name: t('chat.outfit_from_stylist'),
          generated_at: new Date().toISOString(),
          saved: true,
        },
        items,
      });
      setSavedOutfitIds((prev) => new Set([...prev, garmentIds.slice().sort().join(',')]));
      hapticLight();
      toast.success(t('chat.saved'));
    } catch {
      toast.error(t('common.something_wrong'));
    } finally {
      savingRef.current = false;
      setIsSavingOutfit(false);
    }
  }, [user, garmentMap, createOutfit, t]);

  const handleEnterRefine = useCallback((garmentIds: string[], explanation: string) => {
    refineMode.enterRefineMode(garmentIds, explanation);
    hapticLight();
  }, [refineMode]);

  const handleChipTap = useCallback((message: string) => {
    sendMessageRef.current(message);
  }, []);

  const resetThreadUiState = useCallback(() => {
    activeStreamControllerRef.current?.abort();
    activeStreamControllerRef.current = null;
    activeRequestIdRef.current += 1;
    setInput('');
    setPendingPrefill(null);
    setPendingImage(null);
    setPlanActionPayload(null);
    setSuggestionChips([]);
    setLastConfirmedLook(null);
    setPendingLookUpdate(null);
    setSavedOutfitIds(new Set());
    setAnchoredGarmentId(null);
    refineMode.exitRefineMode();
    setIsStreaming(false);
  }, [refineMode]);

  const handleNewThread = useCallback(() => {
    if (hasConversationMessages(messages)) {
      writeSessionMessages(messages, activeChatMode);
    }
    resetThreadUiState();
    const nextMode = createChatThreadMode();
    setActiveChatMode(nextMode);
    setMessages([welcomeMessage]);
    setIsHistoryOpen(false);
    writeSessionMessages([welcomeMessage], nextMode);
    refreshThreadSummaries();
  }, [activeChatMode, messages, refreshThreadSummaries, resetThreadUiState, welcomeMessage]);

  const handleSelectThread = useCallback((mode: string) => {
    if (mode === activeChatMode) {
      setIsHistoryOpen(false);
      return;
    }
    resetThreadUiState();
    setActiveChatMode(mode);
    setIsHistoryOpen(false);
  }, [activeChatMode, resetThreadUiState]);

  const handleComposerFocus = useCallback(() => {
    window.scrollTo(0, 0);
    window.setTimeout(() => {
      window.scrollTo(0, 0);
      scrollToBottom();
    }, 80);
  }, [scrollToBottom]);

  return (
    <PageErrorBoundary fallback={<AIChatFallback />}>
    <AppLayout hideNav disableMainScroll>
      <div className="relative flex h-full flex-col overflow-hidden">
        <ChatHistorySheet
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          threads={threadSummaries}
          activeMode={activeChatMode}
          isLoading={isLoadingThreads}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
        />

        <header className="shrink-0 border-b border-border/35 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[58px] w-full max-w-xl items-center justify-between gap-2 px-3">
            <Button
              variant="quiet"
              size="icon"
              className="h-11 w-11 rounded-full text-muted-foreground"
              onClick={() => setIsHistoryOpen(true)}
              aria-label={t('chat.open_history')}
            >
              <MessagesSquare className="h-4 w-4" />
            </Button>

            <div className="min-w-0 flex-1 text-center">
              <p className="caption-upper mb-0.5 truncate text-muted-foreground/55">
                {t('ai.stylist_eyebrow')}
              </p>
              <h1 className="truncate font-display text-[1.18rem] font-medium italic leading-tight text-foreground">
                {t('chat.mode_stylist')}
              </h1>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="quiet"
                size="icon"
                className="h-11 w-11 rounded-full text-muted-foreground"
                onClick={handleNewThread}
                aria-label={t('chat.new_chat')}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="quiet" size="icon" className="h-11 w-11 rounded-full text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={clearHistory} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('chat.clear_history')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {(garmentCount != null && garmentCount > 0) || anchoredGarment ? (
          <div className="shrink-0 px-3 pt-2">
            <div className="mx-auto flex max-w-xl flex-col gap-2">
              {garmentCount != null && garmentCount > 0 && (
                <p className="text-center text-[11px] font-body tracking-wide text-muted-foreground/38">
                  {t('chat.based_on')} {garmentCount} {t('chat.garments_label')}
                </p>
              )}

              {anchoredGarment && (
                <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-[1rem] border border-border/35 bg-card/70 px-3 py-1.5 text-left">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => navigate(`/wardrobe/${anchoredGarment.id}`)}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] bg-background text-primary">
                      <Shirt className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-primary/70">
                        {t('ai.style_anchor')}
                      </span>
                      <span className="block truncate text-sm font-medium text-foreground">{anchoredGarment.title}</span>
                    </span>
                  </button>
                  <Button
                    variant="quiet"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
                    onClick={() => setAnchoredGarmentId(null)}
                    aria-label={t('chat.clear_anchor')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide"
          style={{
            paddingBottom: `${inputDockHeight + keyboardInset + 16}px`,
            scrollPaddingBottom: `${inputDockHeight + keyboardInset + 16}px`,
          }}
        >
          {isLoading ? (
            <ChatPageSkeleton />
          ) : isWelcomeState ? (
            <ChatWelcome onSuggestion={sendMessage} garmentCount={garmentCount ?? undefined} />
          ) : (
            <div className="mx-auto max-w-xl space-y-5 px-[var(--page-px)] py-4">
            {messages.map((msg, idx) => {
              if (idx === 0 && msg.role === 'assistant' && !isStreaming) {
                if (getTextContent(msg.content) === t('chat.welcome')) return null;
              }
              const isStreamingMsg = isStreaming && idx === messages.length - 1 && msg.role === 'assistant';
              const isEmpty = getTextContent(msg.content) === '';
              const isLatestAssistant = msg.role === 'assistant' && idx === messages.length - 1;
              return (
                <motion.div
                  key={`${msg.role}-${idx}`}
                  variants={PRESETS.MESSAGE.variants}
                  initial="initial"
                  animate="animate"
                  transition={PRESETS.MESSAGE.transition}
                >
                  {isStreamingMsg && isEmpty && !currentVisibleLook ? (
                    <StylistReplyPlaceholder />
                  ) : (
                    <ChatMessage
                      message={msg}
                      isStreaming={isStreamingMsg}
                      garmentMap={garmentMap}
                      onTryOutfit={handleTryOutfit}
                      isCreatingOutfit={createOutfit.isPending}
                      showStyleCards={msg.role === 'assistant'}
                      displayMetaOverride={isLatestAssistant ? currentVisibleLook : null}
                      onGarmentClick={(id) => navigate(`/wardrobe/${id}`)}
                      isRefining={refineMode.isRefining && isLatestAssistant}
                      lockedSlots={refineMode.lockedSlots}
                      onRefine={handleEnterRefine}
                      onSave={handleSaveFromChat}
                      onToggleLock={refineMode.toggleLock}
                      isSaving={isSavingOutfit}
                      isHistoricalOutfit={msg.role === 'assistant' && !isLatestAssistant}
                      isSaved={savedOutfitIds.has(
                        (msg.stylistMeta?.active_look?.garment_ids ?? msg.stylistMeta?.outfit_ids ?? []).slice().sort().join(',')
                      )}
                    />
                  )}
                </motion.div>
              );
            })}
            {/* Plan action banner */}
            {planActionPayload && !isStreaming && (
              <div className="mt-3 rounded-[1rem] border border-border/40 px-4 py-4">
                <p className="mb-3 font-display italic text-[0.95rem] text-foreground/70">
                  {t('chat.plan_ready')}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="editorial"
                    size="sm"
                    className="h-10 flex-1 rounded-[0.8rem] cursor-pointer"
                    onClick={() => { hapticLight(); handleAddToPlan(planActionPayload); setPlanActionPayload(null); }}
                  >
                    {t('chat.add_to_plan')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 flex-1 rounded-[0.8rem] cursor-pointer border-border/35"
                    onClick={() => { hapticLight(); setPlanActionPayload(null); }}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}
            {suggestionChips.length > 0 && !isStreaming && input === '' ? (
              <div className="pt-1">
                <div className="app-chip-row justify-center px-1">
                  {suggestionChips.map((chip, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="min-h-[40px] rounded-[0.8rem] px-4 cursor-pointer border-border/35 text-[13px] font-body"
                      onClick={() => {
                        hapticLight();
                        setSuggestionChips([]);
                        sendMessage(chip);
                      }}
                    >
                      {chip}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}

        </div>

        <div
          ref={inputDockRef}
          className="absolute inset-x-0 z-40 overscroll-contain [touch-action:manipulation]"
          style={{ bottom: `${keyboardInset}px` }}
        >
          <AnimatePresence>
            {refineMode.isRefining && (
              <motion.div
                key="refine-dock"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.25 }}
                className="border-t border-border/25 bg-background/92 px-3 py-2 backdrop-blur-xl"
              >
                <div className="mx-auto max-w-xl space-y-2">
                  <RefineChips
                    garments={refineMode.activeGarmentIds.map((id) => garmentMap.get(id)).filter(Boolean) as GarmentBasic[]}
                    onChipTap={handleChipTap}
                    canUndo={refineMode.canUndo}
                    onUndo={refineMode.undo}
                  />
                  <RefineBanner
                    garments={refineMode.activeGarmentIds.map((id) => garmentMap.get(id)).filter(Boolean) as GarmentBasic[]}
                    onStopRefining={refineMode.exitRefineMode}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ChatInput
            input={input}
            onInputChange={setInput}
            onSend={() => { hapticLight(); sendMessage(); }}
            onImageSelect={handleImageSelect}
            pendingImage={pendingImage}
            onClearImage={() => setPendingImage(null)}
            isStreaming={isStreaming}
            isUploading={isUploading}
            onFocus={handleComposerFocus}
            keyboardOpen={isKeyboardOpen}
          />
        </div>
      </div>
    </AppLayout>
    </PageErrorBoundary>
  );
}
