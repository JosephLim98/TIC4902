import * as logService from '../service/logService.js';
import * as flinkService from '../service/flinkService.js';
import logger from '../utils/logger.js'

export async function streamDeploymentLogs(req, res, next) {
    const { deploymentName } = req.params;
    const { component, search, levels } = req.query;
    const levelFilter = levels ? levels.split(',') : undefined;

    let deployment;
    try {
        // Namespace and existence resolved server-side. Never trust client-supplied namespace
        deployment = await flinkService.getDeployment(deploymentName);
    } catch (error) {
        return next(error);
    }

    const params = {
        deploymentName,
        component,
        search,
        levels: levelFilter
    };

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    let lastTs = Date.now() - 5 * 60 * 1000;        // backfill last 5 mins by default
    let closed = false;
    let ws;

    const safeWrite = (chunk) => {
        if (closed) {
            return;
        }

        try {
            res.write(chunk);
        } catch (error) {
            logger.warn('Failed to write to log stream', { deploymentName, error: error.message });
        }
    };

    const sendLine = (entry) => {
        safeWrite(`data: ${JSON.stringify(entry)}\n\n`);
        lastTs = Math.max(lastTs, entry.ts);
    };

    try {
        const history = await logService.queryRange(params, lastTs * 1e6, Date.now() * 1e6);
        history.forEach(sendLine);
    } catch (error) {
        logger.warn('Log history backfill failed', { deploymentName, error: error.message });
        safeWrite(`event: warning\ndata: ${JSON.stringify({ message: 'History backfill unavailable' })}\n\n`);
    }

    // status "connected" or "reconnecting" reflects the real state of the Loki tail socket. The tail socket now reconnects with backoff on its own as the 
    ws = logService.openTailSocket(params, sendLine, (status) => {
        safeWrite(`event: status\ndata: ${JSON.stringify({ status })}\n\n`);
    });

    const heartbeat = setInterval(() => safeWrite(':\n\n'), 15000);
    req.on('close', () => {
        closed = true;
        clearInterval(heartbeat);
        ws?.close();
    });
}