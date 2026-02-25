'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Send, Hash, Clock, User as UserIcon, MessageSquare } from 'lucide-react';

interface CartConversation {
    id: string;
    status: string;
    submittedAt: string;
    user: { email: string; companyName?: string; firstName?: string; lastName?: string };
}

interface Message {
    id: string;
    content: string;
    createdAt: string;
    sender: { firstName?: string; lastName?: string; email: string; userType: string };
}

function initials(first?: string, last?: string, fallback = 'Q') {
    const a = first?.[0]?.toUpperCase();
    const b = last?.[0]?.toUpperCase();
    return (a || b ? `${a ?? ''}${b ?? ''}` : fallback).trim() || fallback;
}

export default function SalesMessagesPage() {
    const [conversations, setConversations] = useState<CartConversation[]>([]);
    const [selectedCart, setSelectedCart] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.getQuoteRequests()
            .then((data) => {
                const carts = (data as CartConversation[]).filter(c => c.status === 'quoted');
                setConversations(carts);
                if (carts.length > 0) setSelectedCart(carts[0].id);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
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
        fetchMessages(selectedCart)
            .finally(() => setMsgLoading(false));

        // Optional: Polling every 10 seconds for real-time feel
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

    const selectedConversation = conversations.find((c) => c.id === selectedCart);

    return (
        <main className="min-h-screen py-10 px-6 lg:px-10 font-sans tracking-tight">
            <div className="max-w-[1300px] mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8 pl-1">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Message Center</h1>
                        <p className="text-[13px] text-gray-400 font-medium mt-1">Communicate directly with buyers about quotes</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-300">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Loading Conversations...</span>
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] border border-gray-50/50 p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                        <p className="text-lg font-bold text-gray-900">No conversations yet</p>
                        <p className="text-[13px] text-gray-400 font-medium mt-2">When buyers send messages, they will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh] min-h-[600px]">
                        {/* Conversation List (LEFT) */}
                        <div className="lg:col-span-4 bg-white rounded-[2.5rem] border border-gray-50/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-gray-50/80 bg-gray-50/30">
                                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Active Threads</h2>
                                <h3 className="text-lg font-bold text-gray-900">{conversations.length} Requests</h3>
                            </div>

                            <div className="overflow-y-auto flex-1 divide-y divide-gray-50/80 p-2">
                                {conversations.map((c) => {
                                    const isActive = selectedCart === c.id;
                                    const buyerName = [c.user.firstName, c.user.lastName].filter(Boolean).join(' ') || c.user.companyName || c.user.email;
                                    const badgeLabel = c.status === 'submitted' ? 'Under Review' : c.status.replace(/_/g, ' ');

                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedCart(c.id)}
                                            className={`w-full text-left p-4 rounded-2xl transition-all duration-200 group flex items-start gap-4
                                                ${isActive
                                                    ? 'bg-[#0F172A] shadow-lg shadow-gray-900/10'
                                                    : 'hover:bg-gray-50/80'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 uppercase tracking-widest text-[11px] font-bold
                                                ${isActive ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                {initials(c.user.firstName, c.user.lastName, c.user.email?.[0].toUpperCase())}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-[14px] font-bold truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                                        {buyerName}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md
                                                        ${isActive ? 'bg-white/10 text-gray-300' : 'bg-indigo-50 text-indigo-500'}`}>
                                                        {badgeLabel}
                                                    </span>
                                                    <span className={`text-[10px] font-medium truncate ${isActive ? 'text-gray-400' : 'text-gray-400'}`}>
                                                        Req: {c.id.slice(0, 6)}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Message Thread (RIGHT) */}
                        <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-gray-50/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col overflow-hidden relative">
                            {selectedConversation ? (
                                <>
                                    {/* Thread Header */}
                                    <div className="px-8 py-6 border-b border-gray-50/80 flex items-center justify-between bg-white z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
                                                <UserIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-[16px] font-bold text-gray-900">
                                                    {[selectedConversation.user.firstName, selectedConversation.user.lastName].filter(Boolean).join(' ') || selectedConversation.user.companyName || selectedConversation.user.email}
                                                </h2>
                                                <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                                    <div className="flex items-center gap-1"><Hash className="w-3 h-3" /> {selectedConversation.id.slice(0, 8)}</div>
                                                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                                                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(selectedConversation.submittedAt).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Message History */}
                                    <div className="flex-1 overflow-y-auto px-8 py-6 bg-gray-50/20">
                                        {msgLoading && messages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-300">
                                                <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center py-10">
                                                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 mb-4">
                                                    <Send className="w-6 h-6" />
                                                </div>
                                                <p className="text-[14px] font-bold text-gray-900">Start the conversation</p>
                                                <p className="text-[12px] text-gray-400 font-medium mt-1">Send a message to update the buyer on their request.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {messages.map((m) => {
                                                    const isSales = m.sender.userType !== 'external';
                                                    const senderName = [m.sender.firstName, m.sender.lastName].filter(Boolean).join(' ') || m.sender.email;
                                                    const isSystem = m.content.startsWith('[System]');

                                                    if (isSystem) {
                                                        return (
                                                            <div key={m.id} className="flex flex-col items-center justify-center w-full py-2">
                                                                <div className="px-5 py-1.5 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                                                                        {m.content.replace('[System] ', '').replace('[System]', '')}
                                                                    </p>
                                                                </div>
                                                                <span className="text-[8px] text-gray-300 mt-1 font-bold uppercase tracking-[0.2em]">
                                                                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div key={m.id} className={`flex ${isSales ? 'justify-end' : 'justify-start'}`}>
                                                            <div className={`max-w-[75%] md:max-w-[60%] rounded-[1.75rem] px-6 py-4 shadow-sm relative group
                                                                ${isSales
                                                                    ? 'bg-[#0F172A] text-white rounded-tr-sm'
                                                                    : 'bg-white border border-gray-100/80 text-gray-900 rounded-tl-sm'
                                                                }`}
                                                            >
                                                                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2
                                                                    ${isSales ? 'text-gray-400' : 'text-gray-400'}`}>
                                                                    {isSales ? 'You' : senderName} • {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                                <div className="text-[14px] leading-relaxed whitespace-pre-wrap font-medium">
                                                                    {m.content}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div ref={messagesEndRef} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Input Area */}
                                    <div className="p-4 bg-white border-t border-gray-50/80">
                                        <div className="flex gap-3 bg-gray-50/50 p-2 rounded-[2rem] border border-gray-100 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all">
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
                                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0
                                                    ${sending || !newMessage.trim()
                                                        ? 'bg-gray-100 text-gray-400'
                                                        : 'bg-[#0F172A] text-white hover:bg-black shadow-[0_4px_14px_0_rgba(15,23,42,0.39)]'
                                                    }`}
                                            >
                                                {sending ? (
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4 ml-0.5" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-center mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-300">
                                            Press Enter to send
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-gray-50/20">
                                    <div className="w-16 h-16 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-300 mb-4 shadow-sm">
                                        <MessageSquare className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">No Request Selected</h3>
                                    <p className="text-[13px] text-gray-400 font-medium mt-1">Select a conversation from the left to view messages.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
