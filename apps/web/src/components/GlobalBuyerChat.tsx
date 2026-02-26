'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, Send, X } from 'lucide-react';
import { api } from '@/lib/api';

export default function GlobalBuyerChat() {
    const router = useRouter();
    const pathname = usePathname();

    const [activeQuotation, setActiveQuotation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Fetch active quotation on mount and periodically
    const fetchActiveQuotation = useCallback(async () => {
        try {
            const allQuotes = await api.getMyQuotations() as any[];
            // Filter quotes that are either QUOTED or COUNTERED
            const eligibleQuotes = allQuotes.filter((q) => {
                const status = (q.status || '').toLowerCase();
                return status === 'quoted' || status === 'countered';
            });

            if (eligibleQuotes.length === 0) {
                setActiveQuotation(null);
                return;
            }

            // Find the most recently updated one within the eligible subset
            const mostRecent = eligibleQuotes.sort((a, b) => {
                const aTime = new Date(a.updatedAt || a.sentAt || a.createdAt).getTime();
                const bTime = new Date(b.updatedAt || b.sentAt || b.createdAt).getTime();
                return bTime - aTime;
            })[0];

            // Only update if it changed
            setActiveQuotation((prev: any) => (prev?.id === mostRecent.id ? prev : mostRecent));

        } catch (err) {
            console.error('Failed to fetch quotations for global chat', err);
        }
    }, []);

    useEffect(() => {
        fetchActiveQuotation();
        const interval = setInterval(fetchActiveQuotation, 30000); // Check for active quotes every 30s
        return () => clearInterval(interval);
    }, [fetchActiveQuotation]);


    // 2. Fetch messages for the active quotation
    const fetchMessages = useCallback(async () => {
        const cartId = activeQuotation?.intendedCart?.id || activeQuotation?.cart?.id;
        if (!cartId) return;

        try {
            const data = await api.getBuyerQuotationMessages(cartId);
            const msgs = data as any[];
            setMessages(msgs);

            // Unread checking
            if (!isChatOpen && msgs.length > 0) {
                const lastSeen = localStorage.getItem(`buyer_chat_last_seen_${cartId}`);
                const lastMsgTime = new Date(msgs[msgs.length - 1].createdAt).getTime();
                if (!lastSeen || lastMsgTime > parseInt(lastSeen)) {
                    setHasUnread(true);
                }
            }
        } catch (err) {
            console.error('Failed to load messages globally', err);
        }
    }, [activeQuotation, isChatOpen]);


    useEffect(() => {
        if (activeQuotation) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 10000);
            return () => clearInterval(interval);
        }
    }, [activeQuotation, fetchMessages]);

    useEffect(() => {
        const cartId = activeQuotation?.intendedCart?.id || activeQuotation?.cart?.id;
        if (isChatOpen && messages.length > 0 && cartId) {
            setHasUnread(false);
            localStorage.setItem(`buyer_chat_last_seen_${cartId}`, new Date(messages[messages.length - 1].createdAt).getTime().toString());
        }
    }, [isChatOpen, messages, activeQuotation]);

    useEffect(() => {
        if (messagesEndRef.current && isChatOpen) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isChatOpen]);


    // 3. Send message
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const cartId = activeQuotation?.intendedCart?.id || activeQuotation?.cart?.id;
        if (!newMessage.trim() || !cartId || isSending) return;

        const content = newMessage.trim();
        setNewMessage('');
        setIsSending(true);

        try {
            await api.sendBuyerQuotationMessage(cartId, content);
            await fetchMessages();
        } catch (err) {
            alert('Failed to send message');
            setNewMessage(content); // restore on fail
        } finally {
            setIsSending(false);
        }
    };


    // 4. Render
    if (!activeQuotation) return null; // Hide if no active quotation

    const salesName = activeQuotation.createdBy
        ? [activeQuotation.createdBy.firstName, activeQuotation.createdBy.lastName].filter(Boolean).join(' ') || activeQuotation.createdBy.email
        : 'Sales Rep';

    const quotationIdShort = activeQuotation.quotationNumber || `#${activeQuotation.id.slice(0, 8)}`;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {isChatOpen ? (
                <div className="w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col border border-primary-100 overflow-hidden transform transition-all duration-300 ease-out origin-bottom-right scale-100 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-primary-900 text-white p-4 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <MessageSquare className="w-5 h-5 text-primary-200" />
                                <h3 className="font-semibold text-[15px]">Chat with {salesName}</h3>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-primary-200/90 ml-7">
                                <span>Regarding</span>
                                <button
                                    onClick={() => router.push(`/app/quotations/${activeQuotation.id}`)}
                                    className="font-bold underline text-white hover:text-amber-100 transition-colors"
                                >
                                    {quotationIdShort}
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsChatOpen(false)}
                            className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-primary-50/30">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6">
                                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-400 mb-3">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-medium text-primary-800">No messages yet</p>
                                <p className="text-xs text-primary-500 mt-1">Start the conversation with your sales representative regarding quote {quotationIdShort}.</p>
                            </div>
                        ) : (
                            messages.map((msg, i) => {
                                const isSender = msg.senderType === 'buyer';
                                return (
                                    <div key={i} className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] ${isSender
                                            ? 'bg-primary-900 text-white rounded-br-sm'
                                            : 'bg-white border border-primary-100 text-primary-900 rounded-bl-sm shadow-sm'
                                            }`}>
                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                        </div>
                                        <div className="flex items-center gap-1 mt-1.5 px-1">
                                            <span className="text-[9px] font-medium text-primary-400 capitalize">
                                                {msg.senderName || msg.senderType}
                                            </span>
                                            <span className="text-[9px] text-primary-300">•</span>
                                            <span className="text-[9px] text-primary-400 tabular-nums">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 bg-white border-t border-primary-100">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-1 bg-primary-50 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-900 text-primary-900 placeholder:text-primary-400"
                                disabled={isSending}
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim() || isSending}
                                className="bg-primary-900 text-white p-2.5 rounded-xl hover:bg-primary-800 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsChatOpen(true)}
                    className="relative bg-primary-900 text-white p-4 rounded-full shadow-xl hover:bg-primary-800 transition-all hover:scale-105 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-primary-900/20"
                >
                    <MessageSquare className="w-6 h-6" />
                    {hasUnread && (
                        <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-pulse shadow-sm" />
                    )}
                </button>
            )}
        </div>
    );
}
