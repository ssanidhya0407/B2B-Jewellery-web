'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MessageSquare, Send } from 'lucide-react';

interface CartConversation {
    id: string;
    status: string;
    submittedAt: string;
    user: { email: string; companyName?: string; name?: string };
}

interface Message {
    id: string;
    content: string;
    createdAt: string;
    sender: { name?: string; email: string; userType: string };
}

export default function SalesMessagesPage() {
    const [conversations, setConversations] = useState<CartConversation[]>([]);
    const [selectedCart, setSelectedCart] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        api.getQuoteRequests()
            .then((data) => {
                const carts = data as CartConversation[];
                setConversations(carts);
                if (carts.length > 0) setSelectedCart(carts[0].id);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedCart) return;
        setMsgLoading(true);
        api.getSalesMessages(selectedCart)
            .then((data) => setMessages(data as Message[]))
            .catch(console.error)
            .finally(() => setMsgLoading(false));
    }, [selectedCart]);

    const handleSend = async () => {
        if (!selectedCart || !newMessage.trim()) return;
        setSending(true);
        try {
            await api.sendSalesMessage(selectedCart, newMessage.trim());
            setNewMessage('');
            const data = await api.getSalesMessages(selectedCart);
            setMessages(data as Message[]);
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const selectedConversation = conversations.find((c) => c.id === selectedCart);

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary-900">Messages</h1>
                    <p className="text-primary-500 text-sm mt-1">Communicate with buyers about their requests</p>
                </div>

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading…</div>
                ) : conversations.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No conversations yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)]">
                        {/* Conversation list */}
                        <div className="bg-white rounded-2xl border border-primary-100/60 overflow-y-auto">
                            <div className="p-3 border-b border-primary-100/60">
                                <h2 className="text-xs font-bold text-primary-400 uppercase tracking-wider">Conversations</h2>
                            </div>
                            <div className="divide-y divide-primary-50">
                                {conversations.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCart(c.id)}
                                        className={`w-full text-left p-3 hover:bg-primary-50/50 transition-colors ${selectedCart === c.id ? 'bg-gold-50 border-l-2 border-gold-500' : ''}`}
                                    >
                                        <div className="font-medium text-sm text-primary-900">{c.user.companyName || c.user.name || c.user.email}</div>
                                        <div className="text-xs text-primary-400 mt-0.5">
                                            {c.status.replace(/_/g, ' ')} · {new Date(c.submittedAt).toLocaleDateString()}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message thread */}
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-primary-100/60 flex flex-col">
                            {selectedConversation && (
                                <div className="p-4 border-b border-primary-100/60">
                                    <div className="font-medium text-primary-900">
                                        {selectedConversation.user.companyName || selectedConversation.user.email}
                                    </div>
                                    <div className="text-xs text-primary-400">
                                        Request {selectedCart?.slice(0, 8)}… · {selectedConversation.status.replace(/_/g, ' ')}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
                                {msgLoading ? (
                                    <p className="text-primary-400 text-sm">Loading messages…</p>
                                ) : messages.length === 0 ? (
                                    <p className="text-primary-400 text-sm text-center py-8">
                                        No messages yet. Start the conversation!
                                    </p>
                                ) : (
                                    messages.map((m) => {
                                        const isSales = m.sender.userType !== 'external';
                                        return (
                                            <div key={m.id} className={`flex ${isSales ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[70%] rounded-2xl p-3 text-sm ${isSales ? 'bg-primary-900 text-white' : 'bg-primary-50 text-primary-800'}`}>
                                                    <div className="text-xs opacity-70 mb-1">
                                                        {m.sender.name || m.sender.email} · {new Date(m.createdAt).toLocaleTimeString()}
                                                    </div>
                                                    <div className="whitespace-pre-wrap">{m.content}</div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="p-4 border-t border-primary-100/60 flex gap-2">
                                <input
                                    className="input flex-1"
                                    placeholder="Type a message…"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={sending || !newMessage.trim()}
                                    className="btn-primary disabled:opacity-50"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
