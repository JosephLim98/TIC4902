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
                    icon: (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                    )
                };
            case 'stopped':
                return {
                    label: 'Stopped',
                    className: 'status-stopped',
                    icon: (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                    )
                };
            case 'failed':
                return {
                    label: 'Failed',
                    className: 'status-failed',
                    icon: (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                    )
                };
            case 'starting':
                return {
                    label: 'Starting',
                    className: 'status-starting',
                    icon: (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                    )
                };
            default:
                return {
                    label: 'Unknown',
                    className: 'status-unknown',
                    icon: (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                    )
                };
        }
    };

    const config = getStatusConfig();

    return (
        <span className={`status-badge ${config.className}`}>
            <span className="status-icon">{config.icon}</span>
            <span className="status-label">{config.label}</span>
        </span>
    )
}

export default StatusBadge;