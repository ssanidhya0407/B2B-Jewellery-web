'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
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
        dashboardApi.getSubmittedRequests()
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
        dashboardApi.getSalesMessages(selectedCart)
            .then((data) => setMessages(data as Message[]))
            .catch(console.error)
            .finally(() => setMsgLoading(false));
    }, [selectedCart]);

    const handleSend = async () => {
        if (!selectedCart || !newMessage.trim()) return;
        setSending(true);
        try {
            await dashboardApi.sendSalesMessage(selectedCart, newMessage.trim());
            setNewMessage('');
            const data = await dashboardApi.getSalesMessages(selectedCart);
            setMessages(data as Message[]);
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const selectedConversation = conversations.find((c) => c.id === selectedCart);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
                    <p className="text-muted-foreground">Communicate with buyers about their requests</p>
                </div>

                {loading ? (
                    <div className="card text-muted-foreground">Loading…</div>
                ) : conversations.length === 0 ? (
                    <div className="card text-center py-12 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No conversations yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)]">
                        {/* Conversation list */}
                        <div className="card p-0 overflow-y-auto">
                            <div className="p-3 border-b">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase">Conversations</h2>
                            </div>
                            <div className="divide-y">
                                {conversations.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCart(c.id)}
                                        className={`w-full text-left p-3 hover:bg-muted/30 transition-colors ${selectedCart === c.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                                    >
                                        <div className="font-medium text-sm">{c.user.companyName || c.user.name || c.user.email}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {c.status.replace(/_/g, ' ')} · {new Date(c.submittedAt).toLocaleDateString()}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message thread */}
                        <div className="lg:col-span-2 card p-0 flex flex-col">
                            {selectedConversation && (
                                <div className="p-4 border-b">
                                    <div className="font-medium">
                                        {selectedConversation.user.companyName || selectedConversation.user.email}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Request {selectedCart?.slice(0, 8)}… · {selectedConversation.status.replace(/_/g, ' ')}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
                                {msgLoading ? (
                                    <p className="text-muted-foreground text-sm">Loading messages…</p>
                                ) : messages.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-8">
                                        No messages yet. Start the conversation!
                                    </p>
                                ) : (
                                    messages.map((m) => {
                                        const isSales = m.sender.userType !== 'external';
                                        return (
                                            <div key={m.id} className={`flex ${isSales ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[70%] rounded-lg p-3 text-sm ${isSales ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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

                            <div className="p-4 border-t flex gap-2">
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
        </DashboardLayout>
    );
}
