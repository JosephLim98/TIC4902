import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../StatusBadge/StatusBadge';
import './PipelineCard.css';

export interface Pipeline {
    id: string;
    name: string;
    status: 'running' | 'stopped' | 'failed' | 'starting';
    parallelism: number;
    uptime: string;
    throughput: string;
    lastModified: string;
    cpuUsage: number;
    memoryUsage: number;
}

interface PipelineCardProps {
    pipeline: Pipeline;
}

const PipelineCard: React.FC<PipelineCardProps> = ({ pipeline }) => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

    const handleStart = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/pipelines/${pipeline.id}/start`, { method: 'POST' });
            console.log('Starting pipeline ', pipeline.id);
        } catch (error) {
            console.error('Failed to start pipeline: ', error);
        }
        setIsMenuOpen(false);
    };

    const handleStop = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/pipelines/${pipeline.id}/stop`, { method: 'POST' });
            console.log('Stopping pipeline ', pipeline.id);
        } catch (error) {
            console.error('Failed to stop pipeline: ', error);
        }
        setIsMenuOpen(false);
    };

    const handleForceStop = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/pipelines/${pipeline.id}/force-stop`, { method: 'POST' });
            console.log('Force stopping pipeline ', pipeline.id);
        } catch (error) {
            console.error('Failed to force stop pipeline: ', error);
        }
        setIsMenuOpen(false);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/pipelines/${pipeline.id}/edit`);
        setIsMenuOpen(false);
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete pipeline "${pipeline.name}"?`)) {
            try {
                await fetch(`/api/pipelines/${pipeline.id}`, { method: 'DELETE' });
                console.log('Deleting pipeline: ', pipeline.id);
            } catch (error) {
                console.error('Failed to delete pipeline: ', error);
            }
        }
        setIsMenuOpen(false);
    };

    const formatUptime = (uptime: string): string => {
        return uptime || 'N/A';
    };

    return (
        <div className="pipeline-card" onClick={() => navigate(`/pipelines/${pipeline.id}`)}>
            <div className="pipeline-card-header">
                <div className="pipeline-info">
                    <h3 className="pipeline-name">{pipeline.name}</h3>
                    <StatusBadge status={pipeline.status} />
                </div>

                <div className="pipeline-actions">
                    <button className="action-menu-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                    >
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>

                    {isMenuOpen && (
                        <div className="action-menu" onClick={(e) => e.stopPropagation()}>
                            {pipeline.status === 'stopped' || pipeline.status === 'failed' ? (
                                <button className="menu-item" onClick={handleStart}>
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    Start
                                </button>
                            ) : (
                                <>
                                    <button className="menu-item" onClick={handleStop}>
                                        <span className="material-symbols-outlined">pause</span>
                                        Stop
                                    </button>

                                    <button className="menu-item danger" onClick={handleForceStop}>
                                        <span className="material-symbols-outlined">stop</span>
                                        Force Stop
                                    </button>
                                </>
                            )}

                            <button className="menu-item" onClick={handleEdit}>
                                <span className="material-symbols-outlined">edit_square</span>
                                Edit
                            </button>

                            <button className="menu-item danger" onClick={handleDelete}>
                                <span className="material-symbols-outlined">delete</span>
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="pipeline-metrics">
                <div className="metric">
                    <div className="metric-label">Parallelism</div>
                    <div className="metric-value">{pipeline.parallelism}</div>
                </div>
                <div className="metric">
                    <div className="metric-label">Uptime</div>
                    <div className="metric-value">{formatUptime(pipeline.uptime)}</div>
                </div>
                <div className="metric">
                    <div className="metric-label">Throughput</div>
                    <div className="metric-value">{pipeline.throughput}</div>
                </div>
            </div>

            <div className="pipeline-resources">
                <div className="resource-bar">
                    <div className="resource-header">
                        <span className="resource-label">CPU Usage</span>
                        <span className="resource-value">{pipeline.cpuUsage}%</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill"
                            style={{
                                width: `${pipeline.cpuUsage}%`,
                                background: pipeline.cpuUsage > 80 ? 'var(--color-error)' :
                                            pipeline.cpuUsage > 60 ? 'var(--color-warning)' :
                                            'var(--color-success)'
                            }}
                        ></div>
                    </div>
                </div>

                <div className="resource-bar">
                    <div className="resource-header">
                        <span className="resource-label">Memory Usage</span>
                        <span className="resource-value">{pipeline.memoryUsage}%</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill"
                            style={{
                                width: `${pipeline.memoryUsage}%`,
                                background: pipeline.memoryUsage > 80 ? 'var(--color-error)' :
                                            pipeline.memoryUsage > 60 ? 'var(--color-warning)' :
                                            'var(--color-success)'
                            }}
                        ></div>
                    </div>
                </div>
            </div>

            <div className="pipeline-footer">
                <span className="footer-text">
                    Last modified: {pipeline.lastModified ? new Date(pipeline.lastModified).toLocaleDateString() : 'N/A'}
                    {/* Last modified: {new Date(pipeline.lastModified).toLocaleDateString()} */}
                </span>
            </div>
        </div>
    );
};

export default PipelineCard;