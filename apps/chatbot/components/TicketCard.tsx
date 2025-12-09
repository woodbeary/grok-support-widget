'use client';

import { CheckCircle2, Ticket, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TicketCardProps {
    title: string;
    description: string;
    ticketId?: string;
    status?: 'created' | 'pending' | 'resolved';
    onStartNew?: () => void;
}

/**
 * Inline Ticket Card - ChatKit-style artifact with "Start New" button.
 * Premium xAI/Grok dark aesthetic with proper cursor states and hover effects.
 */
export default function TicketCard({
    title,
    description,
    ticketId,
    status = 'created',
    onStartNew,
}: TicketCardProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(ticketId || title);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full max-w-sm animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="rounded-xl border border-[#2a2a2a] bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-4 shadow-lg">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">Ticket Created</h4>
                        <p className="text-xs text-gray-500">Support request submitted</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs text-emerald-400 font-medium">Active</span>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#333] to-transparent my-3" />

                {/* Content */}
                <div className="space-y-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Ticket className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Title</span>
                        </div>
                        <p className="text-sm text-white font-medium">{title}</p>
                    </div>

                    <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</span>
                        <p className="mt-1 text-sm text-gray-300 leading-relaxed bg-[#1a1a1a] rounded-lg p-3 border border-[#252525]">
                            {description}
                        </p>
                    </div>

                    {ticketId && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a1a1a] border border-[#252525]">
                            <div>
                                <span className="text-xs text-gray-500">Ticket ID</span>
                                <p className="text-xs font-mono text-gray-400">{ticketId.slice(0, 8)}...</p>
                            </div>
                            <button
                                onClick={handleCopy}
                                className={cn(
                                    "p-2 rounded-lg transition-all text-xs flex items-center gap-1.5 cursor-pointer",
                                    copied
                                        ? "bg-emerald-500/20 text-emerald-400"
                                        : "bg-[#252525] text-gray-400 hover:bg-[#333] hover:text-white"
                                )}
                            >
                                <Copy className="w-3.5 h-3.5" />
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer with Start New Conversation */}
                <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-[#252525]">
                    <div className="flex items-center gap-2">
                        <button className="flex-1 py-2 px-3 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Details
                        </button>
                    </div>

                    {/* Start New Conversation */}
                    <button
                        onClick={onStartNew}
                        className="w-full py-2 px-3 rounded-lg border border-[#333] text-sm text-gray-400 hover:text-white hover:bg-[#1a1a1a] hover:border-[#444] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Start New Conversation
                    </button>
                </div>
            </div>
        </div>
    );
}
