// USED FOR OLD DASHBOARD

import React, { type JSX } from 'react';
import './StatusBadge.css';

type PipelineStatus = 'running' | 'stopped' | 'failed' | 'starting' | 'unknown';

interface StatusBadgeProps {
    status: PipelineStatus;
}

interface StatusConfig {
    label: string;
    className: string;
    icon: JSX.Element;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const getStatusConfig = (): StatusConfig => {
        switch (status.toLowerCase() as PipelineStatus) {
            case 'running':
                return {
                    label: 'Running',
                    className: 'status-running',
                    icon: <span className="material-symbols-outlined icon-fill">circle</span>
                };
            case 'stopped':
                return {
                    label: 'Stopped',
                    className: 'status-stopped',
                    // Stopped is usually an outline to show "inactivity"
                    icon: <span className="material-symbols-outlined">circle</span>
                };
            case 'failed':
                return {
                    label: 'Failed',
                    className: 'status-failed',
                    icon: <span className="material-symbols-outlined">error</span>
                };
            case 'starting':
                return {
                    label: 'Starting',
                    className: 'status-starting',
                    // Sync/loading icon for starting state
                    icon: <span className="material-symbols-outlined">sync</span>
                };
            default:
                return {
                    label: 'Unknown',
                    className: 'status-unknown',
                    icon: <span className="material-symbols-outlined">help</span>
                };
        }
    };

    const config = getStatusConfig();

    return (
        <span className={`status-badge ${config.className}`}>
            <span className="status-icon">{config.icon}</span>
            <span className="status-label">{config.label}</span>
        </span>
    );
};

export default StatusBadge;