import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Phone,
  Clock,
  MessageSquare,
  Bot,
  User,
  CheckCircle2,
  XCircle,
  Timer,
  Copy,
  Loader2,
  Download,
  FileText,
  Music,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, formatDistanceToNow } from 'date-fns';
import { useConversationDetails } from '@/hooks/use-elevenlabs';
import {
  ELConversation,
  ELConversationDetails,
  extractSummary,
  toISOTimestamp,
  BACKEND_URL,
} from '@/services/elevenLabsApi';

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function StatPill({ icon: Icon, label, value, className = '' }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

function TranscriptBubble({ role, message, timeInCall }: {
  role: 'agent' | 'user';
  message: string;
  timeInCall?: number;
}) {
  const isAgent = role === 'agent';
  return (
    <div className={`flex gap-2.5 ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isAgent ? 'bg-primary/15' : 'bg-muted'
      }`}>
        {isAgent
          ? <Bot className="w-3.5 h-3.5 text-primary" />
          : <User className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <div className={`max-w-[78%] space-y-1`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isAgent
            ? 'bg-primary/10 text-foreground rounded-tl-md'
            : 'bg-muted text-foreground rounded-tr-md'
        }`}>
          {message}
        </div>
        {timeInCall !== undefined && (
          <p className={`text-[10px] text-muted-foreground/60 px-1 ${isAgent ? '' : 'text-right'}`}>
            {formatDuration(Math.round(timeInCall))}
          </p>
        )}
      </div>
    </div>
  );
}

interface ConversationDetailDialogProps {
  conv: ELConversation | null;
  open: boolean;
  onClose: () => void;
}

export function ConversationDetailDialog({ conv, open, onClose }: ConversationDetailDialogProps) {
  const { data: details, isLoading } = useConversationDetails(
    open && conv ? conv.conversation_id : undefined,
  );

  if (!conv) return null;

  const ts = new Date(toISOTimestamp(conv));
  const messages: ELConversationDetails['transcript'] =
    (details as ELConversationDetails | undefined)?.transcript ??
    (details as ELConversationDetails | undefined)?.messages ??
    [];
  const summary = extractSummary(undefined, conv, details);
  const isSuccess = conv.call_successful === 'success' || conv.call_successful === 'true';
  const audioSrc = `${BACKEND_URL}/conversations/${conv.conversation_id}/audio`;
  const duration = conv.call_duration_secs ?? 0;
  const msgCount = messages.length || conv.message_count || 0;
  const agentName = conv.agent_name ?? conv.agent_id;
  const title = conv.call_summary_title ?? (summary ? summary.slice(0, 60) + (summary.length > 60 ? '…' : '') : 'Conversation');

  const handleCopyId = () => {
    navigator.clipboard.writeText(conv.conversation_id);
  };

  const handleDownloadAudio = () => {
    const link = document.createElement('a');
    link.href = audioSrc;
    link.download = `conversation-${conv.conversation_id}.mp3`;
    link.click();
  };

  const handleDownloadTranscript = () => {
    const lines = messages.map((msg) => {
      const prefix = msg.role === 'agent' ? 'Agent' : 'User';
      const time = msg.time_in_call_secs !== undefined ? ` [${formatDuration(Math.round(msg.time_in_call_secs))}]` : '';
      return `${prefix}${time}: ${msg.message}`;
    });
    if (summary) lines.unshift(`Summary: ${summary}\n`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversation-${conv.conversation_id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] p-0 gap-0 overflow-hidden">
        {/* ── Hero Header ─────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-primary/8 via-primary/4 to-transparent px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isSuccess ? 'bg-success/15' : 'bg-muted'
            }`}>
              {isSuccess
                ? <CheckCircle2 className="w-5 h-5 text-success" />
                : <XCircle className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold tracking-tight truncate">{title}</h2>
                <Badge variant={isSuccess ? 'success' : 'secondary'} className="shrink-0">
                  {isSuccess ? 'Successful' : conv.status ?? 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5" />
                  {agentName}
                </span>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {format(ts, "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {formatDistanceToNow(ts, { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Loading conversation…</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[calc(92vh-160px)]">
            <div className="px-6 py-5 space-y-5">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <StatPill icon={Timer} label="Duration" value={formatDuration(duration)} />
                <StatPill icon={MessageSquare} label="Messages" value={msgCount} />
                <StatPill icon={Phone} label="Status" value={
                  isSuccess ? 'Successful' : (conv.status ?? 'Unknown')
                } />
              </div>

              {/* Summary */}
              {summary && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</h3>
                  <div className="p-4 rounded-xl bg-muted/50 border border-border text-sm leading-relaxed">
                    {summary}
                  </div>
                </div>
              )}

              {/* Audio */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Audio Recording
                </h3>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <audio
                    controls
                    src={audioSrc}
                    className="w-full h-10"
                    style={{ borderRadius: '8px' }}
                    onError={(e) => {
                      const el = e.currentTarget.closest('.space-y-2');
                      if (el) (el as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>

              <Separator />

              {/* Transcript */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Transcript
                  </h3>
                  {messages.length > 0 && (
                    <span className="text-xs text-muted-foreground/60">
                      {messages.length} message{messages.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {messages.length > 0 ? (
                  <div className="space-y-3 pb-1">
                    {messages.map((msg, i) => (
                      <TranscriptBubble
                        key={i}
                        role={msg.role ?? 'user'}
                        message={msg.message ?? ''}
                        timeInCall={msg.time_in_call_secs}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No transcript available</p>
                  </div>
                )}
              </div>

              {/* Footer meta */}
              <div className="flex items-center justify-between pt-1 pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground/60 hover:text-foreground h-7 px-2"
                  onClick={handleCopyId}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  {conv.conversation_id.slice(0, 16)}…
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDownloadAudio}>
                      <Music className="w-3.5 h-3.5 mr-2" />
                      Audio (MP3)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownloadTranscript} disabled={messages.length === 0}>
                      <FileText className="w-3.5 h-3.5 mr-2" />
                      Transcript (TXT)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
