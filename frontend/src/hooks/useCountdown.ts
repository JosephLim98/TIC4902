import { useEffect, useState } from "react";

// Ticks down the whole seconds remaining until untilEpochMs returns 0 when untilEpochMs is null or already in the past
export function useCountdown(untilEpochMs: number | null): number {
    const secondsLeft = (target: number | null) => target ? Math.max(0, Math.ceil((target - Date.now()) / 1000)) : 0;

    const [remaining, setRemaining] = useState(() => secondsLeft(untilEpochMs));

    useEffect(() => {
        setRemaining(secondsLeft(untilEpochMs));

        if (!untilEpochMs) return;

        const interval = setInterval(() => {
            setRemaining(secondsLeft(untilEpochMs));
        }, 1000);

        return () => clearInterval(interval);
    }, [untilEpochMs]);

    return remaining;
}