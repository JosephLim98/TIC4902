import { useEffect, useMemo, useRef, useState } from 'react';
import { streamDeploymentLogs, type LogEvent, type LogStreamStatus } from '@/api/logs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MaterialIcon } from '@/components/MaterialIcon'
import { cn } from '@/lib/utils'

const LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG'] as const
const LEVEL_STYLES: Record<string, string> = {
    ERROR: 'bg-red-50 text-red-700 border-red-200',
    WARN: 'bg-amber-50 text-amber-700 border-amber-200',
    INFO: 'bg-blue-50 text-blue-700 border-blue-200',
    DEBUG: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}
const LEVEL_TEXT: Record<string, string> = {
    ERROR: 'text-red-400',
    WARN: 'text-amber-400',
}

// Light background + dark text of the same hue, matching the convention
// used everywhere else in the app (see StatusBadge). The previous version
// used a dark bg-amber-700 with the default dark "outline" text color,
// which made the label almost unreadable.
const CONNECTION_STYLES: Record<LogStreamStatus, { label: string; className: string; dotClassName: string; pulse?: boolean }> = {
    connecting:   { label: 'Connecting',   className: 'bg-zinc-100 text-zinc-600 border-zinc-200',    dotClassName: 'bg-zinc-400',   pulse: true },
    connected:    { label: 'Live',         className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotClassName: 'bg-emerald-500' },
    reconnecting: { label: 'Reconnecting', className: 'bg-amber-50 text-amber-700 border-amber-200',  dotClassName: 'bg-amber-500',   pulse: true },
    error:        { label: 'Error',        className: 'bg-red-50 text-red-700 border-red-200',        dotClassName: 'bg-red-500' },
}

const MAX_BUFFERED_LINES = 5000
const TRIM_TO_LINES = 4000

export default function LogViewer({ deploymentName }: { deploymentName: string }) {
    const [lines, setLines] = useState<LogEvent[]>([])
    const [component, setComponent] = useState<'jobmanager' | 'taskmanager'>('jobmanager')
    const [search, setSearch] = useState('')
    const [levels, setLevels] = useState<string[]>([])
    const [autoScroll, setAutoScroll] = useState(false)
    const [status, setStatus] = useState<LogStreamStatus>('connecting')
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const programmaticScrollRef = useRef(false)

    useEffect(() => {
        setLines([])
        setStatus('connecting')
        setStatusMessage(null)
        const close = streamDeploymentLogs(
            deploymentName,
            { component, levels },
            (e) => setLines(prev => (prev.length > MAX_BUFFERED_LINES ? [...prev.slice(-TRIM_TO_LINES), e] : [...prev, e])),
            (nextStatus, message) => {
                setStatus(nextStatus)
                setStatusMessage(message ?? null)
            },
        );
        return close
    }, [deploymentName, component, levels])

    useEffect(() => {
        // Deliberately not using Element.scrollIntoView() here: it walks up
        // every scrollable ancestor to bring the target fully into view,
        // which includes the page itself — so autoscrolling the log box
        // could also silently drag the whole page down. Setting scrollTop
        // directly only ever touches this one container.
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
    }, [lines, autoScroll])

    const visible = useMemo(() => (
        search
            ? lines.filter(l => l.line.toLowerCase().includes(search.toLowerCase()))
            : lines        // client-side text search stays instant, no reconnect needed
    ), [lines, search])

    const conn = CONNECTION_STYLES[status]

    return (
        <Card className="border-zinc-200 shadow-none">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Logs
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {lines.length > 0 && (
                            <span className="text-xs text-zinc-400 tabular-nums">
                                {lines.length.toLocaleString()} lines
                            </span>
                        )}
                        <Badge
                            variant="outline"
                            title={statusMessage ?? undefined}
                            className={cn('gap-1.5 rounded-md text-xs font-medium', conn.className)}
                        >
                            <span className={cn('size-1.5 rounded-full', conn.dotClassName, conn.pulse && 'animate-pulse')} />
                            {conn.label}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <Separator className="mb-4" />
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-md border border-zinc-200 p-0.5">
                        {(['jobmanager', 'taskmanager'] as const).map(c => (
                            <Button key={c} size="sm" variant={component === c ? 'default' : 'ghost'} className="h-7 rounded-sm text-xs capitalize" onClick={() => setComponent(c)}>
                                {c === 'jobmanager' ? 'JobManager' : 'TaskManager'}
                            </Button>
                        ))}
                    </div>

                    <Input
                        placeholder="Filter..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-7 w-48 text-xs"
                    />

                    <div className="flex gap-1.5">
                        {LEVELS.map(lvl => (
                            <Badge
                                key={lvl}
                                variant="outline"
                                onClick={() => setLevels(prev => (prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl]))}
                                className={cn(
                                    'cursor-pointer select-none gap-1.5 rounded-md text-xs font-medium',
                                    levels.includes(lvl) ? LEVEL_STYLES[lvl] : 'bg-white text-zinc-400 border-zinc-200',
                                )}
                            >
                                {lvl}
                            </Badge>
                        ))}
                    </div>

                    <div className="flex-1" />

                    {!autoScroll && lines.length > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 rounded-md text-xs"
                            onClick={() => {
                                if (containerRef.current) {
                                    programmaticScrollRef.current = true
                                    containerRef.current.scrollTop = containerRef.current.scrollHeight
                                }
                            }}
                        >
                            <MaterialIcon name="arrow_downward" size={14} />
                            Jump to latest
                        </Button>
                    )}
                </div>

                <div
                    ref={containerRef}
                    className="h-96 overflow-auto rounded-md border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
                    onScroll={e => {
                        // Ignore the scroll event our own "Jump to latest"
                        // click causes — otherwise landing at the bottom
                        // would immediately flip autoScroll back on, turning
                        // a one-time jump into a permanent follow-mode
                        // toggle, which isn't what the button should do.
                        if (programmaticScrollRef.current) {
                            programmaticScrollRef.current = false
                            return
                        }
                        const el = e.currentTarget
                        setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40)
                    }}
                >
                    {visible.length === 0 && (
                        <span className="text-zinc-500">
                            {lines.length === 0
                                ? (status === 'connecting' ? 'Connecting to log stream…' : 'No log lines yet.')
                                : 'No log lines match the current filter.'}
                        </span>
                    )}
                    {visible.map((l, i) => (
                        <div key={`${l.ts}-${i}`} className={LEVEL_TEXT[l.stream.level ?? ''] ?? ''}>
                            {l.line}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}