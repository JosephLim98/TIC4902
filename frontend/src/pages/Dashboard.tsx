import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PipelineCard from '../components/PipelineCard/PipelineCard';
import type { Pipeline } from '../components/PipelineCard/PipelineCard';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/Dashboard.css';

type FilterType = 'all' | 'running' | 'stopped' | 'failed';

interface StatusCounts {
    all: number;
    running: number;
    stopped: number; 
    failed: number;
}

const Dashboard: React.FC = () => {
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    useEffect(() => {
        fetchPipelines();
        const interval = setInterval(fetchPipelines, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchPipelines = async () : Promise<void> => {
        try {
            const response = await fetch(`/api/pipelines`);
            const data = await response.json();
            setPipelines(data);
        } catch (error) {
            console.error('Failed to fetch pipelines: ', error);
            setPipelines(getMockPipelines());
        } finally {
            setLoading(false);
        }
    };

    const getMockPipelines = (): Pipeline[] => [
        {
            id: '1',
            name: 'User Analytics Stream',
            status: 'running',
            parallelism: 4,
            uptime: '2d 14h 32m',
            throughput: '1.2k events/sec',
            lastModified: '2024-01-25T10:30:00Z',
            cpuUsage: 45,
            memoryUsage: 62
        },
        {
            id: '2',
            name: 'Payment Processing Pipeline',
            status: 'running',
            parallelism: 8,
            uptime: '5d 8h 15m',
            throughput: '850 events/sec',
            lastModified: '2024-01-24T15:20:00Z',
            cpuUsage: 72,
            memoryUsage: 78
        },
        {
            id: '3',
            name: 'IoT Sensor Aggregation',
            status: 'stopped',
            parallelism: 2,
            uptime: '0h 0m',
            throughput: '0 events/sec',
            lastModified: '2024-01-26T09:00:00Z',
            cpuUsage: 0,
            memoryUsage: 0
        },
        {
            id: '4',
            name: 'Fraud Detection System',
            status: 'failed',
            parallelism: 6,
            uptime: '0h 0m',
            throughput: '0 events/sec',
            lastModified: '2024-01-27T08:45:00Z',
            cpuUsage: 0,
            memoryUsage: 0
        }
    ];

    const getFilteredPipelines = (): Pipeline[] => {
        let filtered = pipelines;
        if (filter != 'all') {
            filtered = filtered.filter(p => p.status === filter);
        }
        if (searchQuery) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return filtered;
    };

    const getStatusCounts = (): StatusCounts => {
        return {
            all: pipelines.length,
            running: pipelines.filter(p => p.status === 'running').length,
            stopped: pipelines.filter(p => p.status === 'stopped').length,
            failed: pipelines.filter(p => p.status == 'failed').length
        };
    };

    const filteredPipelines = getFilteredPipelines();
    const statusCounts = getStatusCounts();

    if (loading) {
        return (
            <div className="dashboard-loading">
                <LoadingSpinner size="large"/>
                <p>Loading pipelines...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Header Section */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Flink Pipelines Dashboard</h1>
                    <p className="dashboard-subtitle">Monitor and manage your streaming data pipelines</p>
                </div>

                {/* TODO: Replace with actual pipeline endpoint */}
                <Link to="/pipelines/create" className="btn-primary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Create Pipeline
                </Link>
            </div>

            {/* Status Overview */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #00d9ff 0%, #0099ff 100%)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                        </svg>
                    </div>

                    <div className="stat-content">
                        <div className="stat-label">Total Pipelines</div>
                        <div className="stat-value">{statusCounts.all}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#00e676' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                    </div>

                    <div className="stat-content">
                        <div className="stat-label">Running</div>
                        <div className="stat-value">{statusCounts.running}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#ffa726' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>

                    <div className="stat-content">
                        <div className="stat-label">Stopped</div>
                        <div className="stat-value">{statusCounts.stopped}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#ff5252' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </div>

                    <div className="stat-content">
                        <div className="stat-label">Failed</div>
                        <div className="stat-value">{statusCounts.failed}</div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="dashboard-controls">
                <div className="filter-tabs">
                    <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All ({statusCounts.all})
                    </button>
                    
                    <button className={`filter-tab ${filter === 'running' ? 'active' : ''}`}
                        onClick={() => setFilter('running')}
                    >
                        Running ({statusCounts.running})
                    </button>
                    
                    <button className={`filter-tab ${filter === 'stopped' ? 'active' : ''}`}
                        onClick={() => setFilter('stopped')}
                    >
                        Stopped ({statusCounts.stopped})
                    </button>
                    
                    <button className={`filter-tab ${filter === 'failed' ? 'active' : ''}`}
                        onClick={() => setFilter('failed')}
                    >
                        Failed ({statusCounts.failed})
                    </button>
                </div>

                <div className="search-box">
                    <span className="material-symbols-outlined">search</span>
                    {/* <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg> */}
                    <input
                        type="text"
                        placeholder="Search pipelines..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Pipeline Grid */}
            {filteredPipelines.length === 0 ? (
                <div className="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    <h3>No pipelines found</h3>
                    <p>
                        {searchQuery
                            ? 'Try adjusting your search query'
                            : filter === 'all'
                            ? 'Create your first pipeline to get started'
                            : `No ${filter} pipelines at the moment`
                        }
                    </p>
                    {filter === 'all' && !searchQuery && (
                        <Link to="/pipelines/create" className="btn-primary">
                            Create Your First Pipeline
                        </Link>
                    )}
                </div>
            ) : (
                <div className="pipeline-grid">
                    {filteredPipelines.map((pipeline) => (
                        <PipelineCard key={pipeline.id} pipeline={pipeline} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dashboard;