'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, MessageSquare, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { deriveCanonicalWorkflowStatus, latestQuotationForThread, type CanonicalWorkflowStatus } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';

interface ConversationRequest {
  id: string;
  status: string;
  submittedAt?: string;
  assignedAt?: string | null;
  user: {
    email: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
  };
  quotations?: Array<{ id: string; status: string; sentAt?: string; createdAt?: string }>;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: { firstName?: string; lastName?: string; email: string; userType: string };
}

function safeDate(value?: string) {
  if (!value) return 'Date unavailable';
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return 'Date unavailable';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeTime(value?: string) {
  if (!value) return '--:--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(first?: string, last?: string, fallback = 'Q') {
  const a = first?.[0]?.toUpperCase();
  const b = last?.[0]?.toUpperCase();
  return (a || b ? `${a ?? ''}${b ?? ''}` : fallback).trim() || fallback;
}

function buyerName(user: ConversationRequest['user']) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.companyName || user.email;
}

function canonicalForConversation(c: ConversationRequest): CanonicalWorkflowStatus {
  return deriveCanonicalWorkflowStatus({
    cartStatus: c.status,
    latestQuotationStatus: latestQuotationForThread(c.quotations)?.status,
    opsForwarded: Boolean(c.assignedAt),
  });
}

export default function SalesMessagesPage() {
  const [conversations, setConversations] = useState<ConversationRequest[]>([]);
  const [selectedCart, setSelectedCart] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    api.getQuoteRequests()
      .then((data) => {
        if (!mounted) return;
        const requests = data as ConversationRequest[];
        const scoped = requests.filter((c) => {
          const status = canonicalForConversation(c);
          return status === 'QUOTED' || status === 'COUNTER' || status === 'FINAL';
        });

        scoped.sort((a, b) => {
          const ta = new Date(a.submittedAt || 0).getTime();
          const tb = new Date(b.submittedAt || 0).getTime();
          return tb - ta;
        });

        setConversations(scoped);
        setSelectedCart(scoped.length > 0 ? scoped[0].id : null);
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const fetchMessages = async (cartId: string) => {
    try {
      const data = await api.getSalesMessages(cartId);
      setMessages(data as Message[]);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!selectedCart) return;
    setMsgLoading(true);
    fetchMessages(selectedCart).finally(() => setMsgLoading(false));

    const intervalId = setInterval(() => {
      fetchMessages(selectedCart);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [selectedCart]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!selectedCart || !newMessage.trim()) return;
    setSending(true);
    try {
      await api.sendSalesMessage(selectedCart, newMessage.trim());
      setNewMessage('');
      await fetchMessages(selectedCart);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedCart) || null,
    [conversations, selectedCart]
  );

  const selectedCanonical = selectedConversation ? canonicalForConversation(selectedConversation) : null;
  const chatLocked = selectedCanonical === 'FINAL' || selectedCanonical === 'CLOSED_ACCEPTED' || selectedCanonical === 'CLOSED_DECLINED';

  return (
    <main className="min-h-screen py-10 px-6 lg:px-10 font-sans tracking-tight">
      <div className="mx-auto max-w-[1300px] space-y-7">
        <header className="rounded-[2rem] border border-gray-100 bg-white px-6 py-5 shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Sales communication</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Message Center</h1>
          <p className="mt-1 text-sm text-gray-500">Buyer threads for active negotiation stages (Quoted, Counter, Final).</p>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32 text-gray-300">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Loading conversations</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-[2.2rem] border border-gray-100 bg-white p-16 text-center shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
            <p className="text-lg font-bold text-gray-900">No negotiation conversations</p>
            <p className="mt-1 text-[13px] font-medium text-gray-500">Conversations appear when requests reach Quoted, Counter, or Final stages.</p>
          </div>
        ) : (
          <div className="grid min-h-[620px] grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4 overflow-hidden rounded-[2.2rem] border border-gray-100 bg-white shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
              <div className="border-b border-gray-100 px-5 py-4 bg-gray-50/40">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Conversations</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{conversations.length} active thread(s)</p>
              </div>

              <div className="max-h-[540px] space-y-1 overflow-y-auto p-2">
                {conversations.map((c) => {
                  const isActive = selectedCart === c.id;
                  const canonical = canonicalForConversation(c);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCart(c.id)}
                      className={`w-full rounded-2xl p-3.5 text-left transition ${isActive ? 'bg-[#0F172A] text-white' : 'hover:bg-gray-50/80'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 shrink-0 rounded-full text-[11px] font-bold uppercase flex items-center justify-center ${isActive ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {initials(c.user.firstName, c.user.lastName, c.user.email?.[0]?.toUpperCase())}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-900'}`}>{buyerName(c.user)}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${isActive ? 'bg-white/15 text-gray-200' : canonicalStatusBadgeClass(canonical)}`}>
                              {canonicalStatusDisplayLabel(canonical)}
                            </span>
                            <span className={`text-[10px] ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>Req {c.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="lg:col-span-8 overflow-hidden rounded-[2.2rem] border border-gray-100 bg-white shadow-[0_8px_30px_rgb(15,23,42,0.03)] flex flex-col">
              {selectedConversation ? (
                <>
                  <div className="border-b border-gray-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[17px] font-bold text-gray-900">{buyerName(selectedConversation.user)}</h2>
                      <p className="mt-1 text-xs text-gray-500">Request {selectedConversation.id.slice(0, 8)} · Submitted {safeDate(selectedConversation.submittedAt)}</p>
                    </div>
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${selectedCanonical ? canonicalStatusBadgeClass(selectedCanonical) : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200'}`}>
                      {selectedCanonical ? canonicalStatusDisplayLabel(selectedCanonical) : 'Unknown'}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-gray-50/25 px-6 py-5">
                    {msgLoading && messages.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <div className="h-14 w-14 rounded-full bg-gray-100 text-gray-300 flex items-center justify-center">
                          <MessageSquare className="h-6 w-6" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-gray-900">No messages yet</p>
                        <p className="mt-1 text-xs text-gray-500">Use the composer below to send the first update.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((m) => {
                          const isSales = m.sender.userType !== 'external';
                          const sender = [m.sender.firstName, m.sender.lastName].filter(Boolean).join(' ') || m.sender.email;
                          const isSystem = m.content.startsWith('[System]');

                          if (isSystem) {
                            return (
                              <div key={m.id} className="flex justify-center">
                                <div className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
                                  {m.content.replace('[System] ', '').replace('[System]', '')}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={m.id} className={`flex ${isSales ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[72%] rounded-[1.4rem] px-4 py-3 ${isSales ? 'bg-[#0F172A] text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-900 rounded-tl-sm'}`}>
                                <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isSales ? 'text-gray-300' : 'text-gray-400'}`}>
                                  {isSales ? 'You' : sender} · {safeTime(m.createdAt)}
                                </p>
                                <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 p-4">
                    {chatLocked ? (
                      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Lock className="h-4 w-4 text-gray-400" />
                          Chat is locked for final/closed state.
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 rounded-[1.7rem] border border-gray-100 bg-gray-50/70 p-2 focus-within:ring-2 focus-within:ring-indigo-100">
                        <input
                          className="flex-1 bg-transparent px-4 text-[14px] font-medium text-gray-900 placeholder-gray-400 outline-none"
                          placeholder="Write your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        />
                        <button
                          onClick={handleSend}
                          disabled={sending || !newMessage.trim()}
                          className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center transition ${sending || !newMessage.trim() ? 'bg-gray-200 text-gray-400' : 'bg-[#0F172A] text-white hover:bg-black'}`}
                        >
                          {sending ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center text-center p-8">
                  <div>
                    <div className="mx-auto h-14 w-14 rounded-full bg-gray-100 text-gray-300 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-900">No conversation selected</p>
                    <p className="mt-1 text-xs text-gray-500">Choose a request from the left panel.</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
