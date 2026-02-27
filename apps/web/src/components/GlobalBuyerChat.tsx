'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, Send, X } from 'lucide-react';
import { api } from '@/lib/api';
import { deriveCanonicalWorkflowStatus, latestQuotationForThread } from '@/lib/workflow';

export default function GlobalBuyerChat() {
    const pathname = usePathname();
    const router = useRouter();

    const [threads, setThreads] = useState<any[]>([]);
    const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const selectedThread = useMemo(
        () => threads.find((thread) => thread.cartId === selectedCartId) || null,
        [threads, selectedCartId],
    );

    const fetchActiveThreads = useCallback(async () => {
        try {
            const rows = (await api.getMyQuotations()) as any[];
            if (!Array.isArray(rows) || rows.length === 0) {
                setThreads([]);
                setSelectedCartId(null);
                return;
            }

            const groupedByCart = new Map<string, any[]>();
            rows.forEach((row) => {
                const cartId = row.intendedCart?.id || row.cart?.id;
                if (!cartId) return;
                groupedByCart.set(cartId, [...(groupedByCart.get(cartId) || []), row]);
            });

            const next: any[] = [];
            groupedByCart.forEach((items, cartId) => {
                const latest = latestQuotationForThread(items);
                if (!latest) return;

                const canonical = deriveCanonicalWorkflowStatus({
                    cartStatus: latest.intendedCart?.status || latest.cart?.status,
                    latestQuotationStatus: latest.status,
                    order: latest.order || latest.orders?.[0] || null,
                });

                if (canonical === 'QUOTED' || canonical === 'COUNTER') {
                    next.push({
                        cartId,
                        quotationId: latest.id,
                        displayLabel: cartId.slice(0, 8),
                        salesPerson: [latest.createdBy?.firstName, latest.createdBy?.lastName].filter(Boolean).join(' ') || latest.createdBy?.email || 'Sales Rep',
                        statusLabel: canonical === 'COUNTER' ? 'Counter Offer' : 'Quoted',
                        updatedAt: latest.updatedAt || latest.sentAt || latest.createdAt || new Date().toISOString(),
                    });
                }
            });

            next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setThreads(next);
            setSelectedCartId((prev) => {
                if (prev && next.some((t) => t.cartId === prev)) return prev;
                return next[0]?.cartId || null;
            });
        } catch (error) {
            console.error('Failed to fetch active buyer chat threads', error);
        }
    }, []);

    const fetchMessages = useCallback(async () => {
        if (!selectedThread) return;
        try {
            const data = (await api.getBuyerQuotationMessages(selectedThread.cartId)) as any[];
            const nextMsgs = Array.isArray(data) ? data : [];
            setMessages(nextMsgs);

            if (!isChatOpen && nextMsgs.length > 0) {
                const lastSeen = Number(localStorage.getItem(`buyer_chat_last_seen_${selectedThread.cartId}`) || 0);
                const latestTs = new Date(nextMsgs[nextMsgs.length - 1]?.createdAt).getTime();
                if (latestTs > lastSeen) setHasUnread(true);
            }
        } catch (error) {
            console.error('Failed to fetch buyer chat messages', error);
        }
    }, [selectedThread, isChatOpen]);

    useEffect(() => {
        if (!pathname.startsWith('/app')) return;
        fetchActiveThreads();
        const interval = window.setInterval(fetchActiveThreads, 30000);
        return () => window.clearInterval(interval);
    }, [pathname, fetchActiveThreads]);

    useEffect(() => {
        if (!selectedThread) {
            setMessages([]);
            return;
        }
        fetchMessages();
        const interval = window.setInterval(fetchMessages, 10000);
        return () => window.clearInterval(interval);
    }, [selectedThread, fetchMessages]);

    useEffect(() => {
        if (!isChatOpen || !selectedThread || messages.length === 0) return;
        const latestTs = new Date(messages[messages.length - 1].createdAt).getTime();
        localStorage.setItem(`buyer_chat_last_seen_${selectedThread.cartId}`, String(latestTs));
        setHasUnread(false);
    }, [isChatOpen, selectedThread, messages]);

    useEffect(() => {
        if (isChatOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isChatOpen]);

    const handleSend = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedThread || !newMessage.trim() || isSending) return;
        const content = newMessage.trim();
        setNewMessage('');
        setIsSending(true);
        try {
            await api.sendBuyerQuotationMessage(selectedThread.cartId, content);
            await fetchMessages();
        } catch {
            setNewMessage(content);
            alert('Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    if (!pathname.startsWith('/app') || threads.length === 0) return null;

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                onClick={() => setIsChatOpen((v) => !v)}
                className={`fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-2xl z-50 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95
                    ${isChatOpen ? 'bg-white text-gray-900 rotate-90 ring-1 ring-gray-100' : 'bg-[#0F172A] text-white shadow-primary-900/20'}
                `}
            >
                {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                {hasUnread && !isChatOpen && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
            </button>

            {/* Chat Panel */}
            <div className={`fixed bottom-28 right-8 w-[400px] max-w-[calc(100vw-64px)] bg-white rounded-[2.5rem] border border-gray-50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 overflow-hidden flex flex-col transition-all duration-300 origin-bottom-right
                ${isChatOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}
            `}>
                <div className="px-8 py-6 border-b border-gray-50/50 bg-[#0F172A] text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold">Buyer Negotiation</h2>
                            {selectedThread && (
                                <button
                                    onClick={() => router.push(`/app/quotations/${selectedThread.quotationId}`)}
                                    className="text-[11px] text-gray-300 font-bold uppercase tracking-widest mt-0.5 hover:text-white transition-colors"
                                >
                                    #{selectedThread.displayLabel} · {selectedThread.salesPerson}
                                </button>
                            )}
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {threads.length > 1 && (
                    <div className="px-6 py-3 border-b border-gray-50/60 bg-gray-50/40">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {threads.map((thread) => (
                                <button
                                    key={thread.cartId}
                                    onClick={() => {
                                        setSelectedCartId(thread.cartId);
                                        // router.push(`/app/quotations/${thread.quotationId}`);
                                    }}
                                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition ring-1
                                        ${selectedCartId === thread.cartId
                                            ? 'bg-white text-gray-900 ring-gray-300 shadow-sm'
                                            : 'bg-white/70 text-gray-500 ring-gray-200 hover:text-gray-800'}
                                    `}
                                    title={`${selectedThread.displayLabel} · ${thread.salesPerson}`}
                                >
                                    #{thread.displayLabel} · {thread.statusLabel}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="h-[420px] overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 text-2xl shadow-sm">💬</div>
                            <p className="text-sm font-bold text-gray-900">Start the conversation</p>
                            <p className="text-[12px] text-gray-400 mt-1">Clarify details with your sales representative.</p>
                        </div>
                    ) : (
                        messages.map((message) => {
                            const isSystem = message.content.startsWith('[System]');
                            const isBuyer = message.sender?.userType === 'external';
                            const senderName = [message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(' ').trim() || (isBuyer ? 'You' : 'Sales');

                            if (isSystem) {
                                return (
                                    <div key={message.id} className="text-center">
                                        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white text-gray-500 ring-1 ring-gray-200">
                                            {formatSystemText(message.content)}
                                        </span>
                                    </div>
                                );
                            }

                            return (
                                <div key={message.id} className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] ${isBuyer
                                        ? 'bg-[#0F172A] text-white rounded-br-sm shadow-lg shadow-primary-900/10'
                                        : 'bg-white border border-gray-100 text-gray-900 rounded-bl-sm shadow-sm'
                                        }`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isBuyer ? 'text-gray-300' : 'text-gray-400'}`}>
                                            {senderName} · {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="whitespace-pre-wrap leading-relaxed mt-1 font-medium">{message.content}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-5 border-t border-gray-50/60 bg-white">
                    <form onSubmit={handleSend} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={selectedThread ? `Message ${selectedThread.salesPerson}...` : 'Type your message...'}
                            className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-200 text-gray-900 placeholder:text-gray-400 font-medium"
                            disabled={isSending || !selectedThread}
                        />
                        <button
                            type="submit"
                            disabled={isSending || !newMessage.trim() || !selectedThread}
                            className="bg-[#0F172A] text-white px-4 rounded-xl hover:bg-black disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 shadow-lg shadow-primary-900/10"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                    {selectedThread && (
                        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                            <span>{selectedThread.statusLabel} · Updated {new Date(selectedThread.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            <button
                                onClick={() => router.push(`/app/quotations/${selectedThread.quotationId}`)}
                                className="font-bold hover:text-gray-700"
                            >
                                Open Quote
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
    const formatSystemText = (content: string) => {
        const raw = content.replace('[System]', '').trim();
        const lowered = raw.toLowerCase();
        if (lowered.includes('auto initial quote')) return 'Initial quote offered';
        if (lowered.includes('expiry_extended')) {
            const match = raw.match(/->\s*(.+)$/);
            if (match?.[1]) {
                const date = new Date(match[1].trim());
                if (!Number.isNaN(date.getTime())) {
                    return `Expiry extended to ${date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
                }
            }
            return 'Expiry extended';
        }
        if (lowered.includes('final quotation')) return 'Final offer offered';
        if (lowered.includes('reminder at')) {
            const match = raw.match(/reminder at:\s*(.+)$/i);
            if (match?.[1]) {
                const date = new Date(match[1].trim());
                if (!Number.isNaN(date.getTime())) {
                    return `Decision reminder scheduled for ${date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
                }
            }
            return 'Decision reminder scheduled';
        }
        return raw;
    };
