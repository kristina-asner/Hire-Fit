"use client";

import React, { useState, useEffect, ChangeEvent, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
    UploadCloud,
    FileText,
    CheckCircle2,
    Loader2,
    X,
    Eye,
    BrainCircuit,
    AlertCircle,
    TrendingUp,
    AlertTriangle,
    XCircle,
    Search,
    Download,
    Users,
    Gauge,
    Award,
    Clock,
    Target,
    GitCompare,
    LogOut,
    Trash2
} from 'lucide-react';

// --- Interfaces ---

interface CandidateEvaluation {
    candidate_name: string;
    score: number;
    key_strengths: string[];
    concerns: string[];
    reasoning: string;
    final_recommendation: 'Strong Hire' | 'Hire' | 'Caution' | 'Reject';
}

interface Task {
    id: string;
    filename: string;
    status: 'uploading' | 'pending' | 'processing' | 'completed' | 'failed';
    data: CandidateEvaluation | null;
    jobDescription: string | null;
}

interface AnalysisRecord {
    session_id: string;
    status: Task['status'];
    filename: string | null;
    created_by: string | null;
    job_description: string | null;
    result: CandidateEvaluation | null;
}

type SortField = 'name' | 'score' | 'recommendation';
type SortDir = 'asc' | 'desc';

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export default function AgenticDashboard() {
    const router = useRouter();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateEvaluation | null>(null);
    const [selectedJobDescription, setSelectedJobDescription] = useState<string | null>(null);
    const [jobDescription, setJobDescription] = useState<string>("");
    const [currentUser, setCurrentUser] = useState<string | null>(null);

    // UI State for Drag & Drop
    const [isDragging, setIsDragging] = useState<boolean>(false);

    // UI State for Results Table (search, filter, sort)
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [recommendationFilter, setRecommendationFilter] = useState<string>("all");
    const [sortField, setSortField] = useState<SortField>('score');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // UI State for Candidate Comparison
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

    // Who's signed in (read from the non-HttpOnly cookie set at login).
    // Deferred to an effect so the SSR pass (no `document`) matches the client's
    // first render, then fills in after hydration - a synchronous read here would
    // cause a hydration mismatch.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentUser(readCookie('hf_user'));
    }, []);

    // Load the full shared history on mount so a refresh (or a new login) doesn't
    // make prior work disappear - it's still in Postgres, just not in local state yet.
    useEffect(() => {
        let cancelled = false;

        const loadHistory = async () => {
            try {
                const res = await axios.get<AnalysisRecord[]>('/api/analyses');
                if (cancelled) return;

                const historyTasks: Task[] = res.data.map(r => ({
                    id: r.session_id,
                    filename: r.filename || 'Uploaded file',
                    status: r.status,
                    data: r.result,
                    jobDescription: r.job_description,
                }));

                setTasks(historyTasks);
            } catch (err) {
                console.error('Failed to load history', err);
            }
        };

        loadHistory();
        return () => { cancelled = true; };
    }, []);

    // --- Core Upload Logic (Reusable for both Drop and Click) ---
    const processFiles = async (filesArray: File[]) => {
        if (!jobDescription.trim()) {
            alert("Please enter a Job Description first.");
            return;
        }

        if (filesArray.length === 0) return;

        // Optimistic UI
        const newTasks: Task[] = [];
        for (const file of filesArray) {
            const tempId = Math.random().toString(36).substr(2, 9);
            newTasks.push({
                id: tempId,
                filename: file.name,
                status: 'uploading',
                data: null,
                jobDescription,
            });
        }
        setTasks(prev => [...prev, ...newTasks]);

        // Upload Loop
        for (let i = 0; i < filesArray.length; i++) {
            const file = filesArray[i];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('job_description', jobDescription);

            try {
                const response = await axios.post('/api/analyze', formData);
                const { session_id } = response.data;

                setTasks(prev => prev.map(t =>
                    t.filename === file.name && t.status === 'uploading'
                        ? { ...t, id: session_id, status: 'pending' }
                        : t
                ));
            } catch (error) {
                console.error("Upload failed", error);
                setTasks(prev => prev.map(t => t.filename === file.name ? { ...t, status: 'failed' } : t));
            }
        }
    };

    // --- Event Handlers ---

    // 1. Handle Click Upload
    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
        e.target.value = ""; // Reset input
    };

    // 2. Handle Drag Over (Must prevent default to allow drop)
    const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        if (!jobDescription.trim()) return; // Don't show active state if disabled
        setIsDragging(true);
    };

    // 3. Handle Drag Leave
    const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    // 4. Handle Drop
    const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragging(false);

        if (!jobDescription.trim()) {
            alert("Please enter a Job Description first.");
            return;
        }

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
            e.dataTransfer.clearData();
        }
    };

    // --- Polling Logic ---
    useEffect(() => {
        const interval = setInterval(async () => {
            const activeTasks = tasks.filter(t => ['pending', 'processing'].includes(t.status));
            if (activeTasks.length === 0) return;

            for (const task of activeTasks) {
                try {
                    const res = await axios.get(`/api/status/${task.id}`);
                    if (res.data.status !== task.status || (res.data.status === 'completed' && !task.data)) {
                        setTasks(prev => prev.map(t => {
                            if (t.id === task.id) {
                                return {
                                    ...t,
                                    status: res.data.status,
                                    data: res.data.result
                                };
                            }
                            return t;
                        }));
                    }
                } catch (err) {
                    console.error("Polling error", err);
                }
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [tasks]);

    // Derived State
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.data);

    const activeTasks = tasks.filter(t => ['pending', 'processing', 'uploading'].includes(t.status));

    // Search + filter + sort applied to the results table
    const displayedTasks = completedTasks
        .filter(t => recommendationFilter === 'all' || t.data?.final_recommendation === recommendationFilter)
        .filter(t => (t.data?.candidate_name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .slice()
        .sort((a, b) => {
            let cmp = 0;
            if (sortField === 'score') {
                cmp = (a.data?.score || 0) - (b.data?.score || 0);
            } else if (sortField === 'name') {
                cmp = (a.data?.candidate_name || '').localeCompare(b.data?.candidate_name || '');
            } else if (sortField === 'recommendation') {
                cmp = (a.data?.final_recommendation || '').localeCompare(b.data?.final_recommendation || '');
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

    const handleSort = (field: SortField) => {
        if (field === sortField) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir(field === 'score' ? 'desc' : 'asc');
        }
    };

    const sortIndicator = (field: SortField) => {
        if (field !== sortField) return null;
        return <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
    };

    // --- Candidate Comparison ---
    const toggleCompare = (id: string) => {
        setCompareIds(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= 3) {
                alert('You can compare up to 3 candidates at a time.');
                return prev;
            }
            return [...prev, id];
        });
    };

    const compareTasks = compareIds
        .map(id => completedTasks.find(t => t.id === id))
        .filter((t): t is Task => Boolean(t));

    // --- Logout ---
    const handleLogout = async () => {
        await axios.post('/api/auth/logout');
        router.push('/login');
        router.refresh();
    };

    // --- Delete ---
    const deleteTask = async (id: string) => {
        if (!confirm('Delete this analysis? This removes it for every HR and cannot be undone.')) return;

        try {
            await axios.delete(`/api/analyses/${id}`);
            setTasks(prev => prev.filter(t => t.id !== id));
            setCompareIds(prev => prev.filter(x => x !== id));
            if (selectedCandidate && tasks.find(t => t.id === id)?.data === selectedCandidate) {
                setSelectedCandidate(null);
                setSelectedJobDescription(null);
            }
        } catch (err) {
            console.error('Failed to delete analysis', err);
            alert('Could not delete this analysis. Please try again.');
        }
    };

    const clearAll = async () => {
        if (!confirm(`This deletes ALL ${completedTasks.length} analyses for every HR, permanently. Are you sure?`)) return;

        try {
            await axios.delete('/api/analyses');
            setTasks([]);
            setCompareIds([]);
            setShowCompareModal(false);
            setSelectedCandidate(null);
            setSelectedJobDescription(null);
        } catch (err) {
            console.error('Failed to clear history', err);
            alert('Could not clear the history. Please try again.');
        }
    };

    // --- CSV Export ---
    const exportCSV = () => {
        if (displayedTasks.length === 0) return;

        const headers = ['Candidate Name', 'Score', 'Recommendation', 'Strengths', 'Concerns', 'Reasoning'];
        const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
        const rows = displayedTasks.map(t => [
            t.data?.candidate_name || '',
            String(t.data?.score ?? ''),
            t.data?.final_recommendation || '',
            (t.data?.key_strengths || []).join('; '),
            (t.data?.concerns || []).join('; '),
            t.data?.reasoning || '',
        ]);

        const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'agentic-hire-results.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // --- KPI stats ---
    const totalReviewed = completedTasks.length;
    const avgScore = totalReviewed > 0
        ? Math.round(completedTasks.reduce((sum, t) => sum + (t.data?.score || 0), 0) / totalReviewed)
        : null;
    const strongHireCount = completedTasks.filter(t => t.data?.final_recommendation === 'Strong Hire').length;
    const strongHireRate = totalReviewed > 0 ? Math.round((strongHireCount / totalReviewed) * 100) : null;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900">

            {/* Navbar */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2.5">
                            <div className="bg-orange-600 w-8 h-8 rounded-md flex items-center justify-center">
                                <Target className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-base font-semibold tracking-tight text-gray-900">
                                Hire<span className="text-orange-600">Fit</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-500">
                                {currentUser ? `Signed in as ${currentUser}` : 'AI Recruitment Copilot'}
                            </div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 lg:px-8 py-10 space-y-10">

                {/* KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                    <StatTile
                        icon={Users}
                        label="Candidates Reviewed"
                        value={totalReviewed}
                    />
                    <StatTile
                        icon={Gauge}
                        label="Average Match Score"
                        value={avgScore !== null ? `${avgScore}%` : '—'}
                    />
                    <StatTile
                        icon={Award}
                        label="Strong Hire Rate"
                        value={strongHireRate !== null ? `${strongHireRate}%` : '—'}
                    />
                    <StatTile
                        icon={Clock}
                        label="Active in Queue"
                        value={activeTasks.length}
                    />
                </div>

                {/* Section 1: Job Context & Upload */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Job Description Input */}
                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="text-sm font-semibold text-gray-900 mb-1">Job Context</h2>
                        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                            Paste the full job description here. The agents will use this to score candidates.
                        </p>
                        <textarea
                            className="w-full h-40 p-4 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-sm leading-relaxed transition-colors"
                            placeholder="e.g. Senior Python Developer with 5+ years of experience in FastAPI and Celery..."
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                        ></textarea>
                    </div>

                    {/* File Upload Area */}
                    <div className="lg:col-span-1 h-full">
                        <label
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`flex flex-col items-center justify-center w-full h-full min-h-[200px] border border-dashed rounded-lg cursor-pointer transition-colors duration-150 ${
                                !jobDescription.trim()
                                    ? 'bg-gray-50 border-gray-300 opacity-60 cursor-not-allowed'
                                    : isDragging
                                        ? 'bg-orange-50 border-orange-500'
                                        : 'bg-white border-gray-300 hover:border-orange-400 hover:bg-orange-50/40'
                            }`}
                        >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center p-6 pointer-events-none">
                                <div className={`p-3 rounded-md mb-3 ${
                                    !jobDescription.trim() ? 'bg-gray-200' : isDragging ? 'bg-orange-100' : 'bg-orange-50'
                                }`}>
                                    <UploadCloud className={`w-6 h-6 ${!jobDescription.trim() ? 'text-gray-400' : 'text-orange-600'}`} />
                                </div>
                                <p className="mb-1 text-sm font-semibold text-gray-800">
                                    {isDragging ? 'Drop files now' : 'Upload CVs'}
                                </p>
                                <p className="text-xs text-gray-500 max-w-[200px]">
                                    {!jobDescription.trim()
                                        ? 'Please define the Job Description first'
                                        : 'Drag & drop PDF or DOCX files here, or click to browse'}
                                </p>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                multiple
                                accept=".pdf,.docx,.doc"
                                onChange={handleFileSelect} // Updated handler
                                disabled={!jobDescription.trim()}
                            />
                        </label>
                    </div>
                </div>

                {/* Section 2: Pipeline & Results */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                    {/* Live Pipeline (Active Tasks) */}
                    <div className="xl:col-span-1">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin-slow" />
                            Processing Queue ({activeTasks.length})
                        </h3>

                        <div className="space-y-2">
                            {activeTasks.map(task => (
                                <div key={task.id} className="bg-white p-3 rounded-md border border-gray-200 flex items-center justify-between group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-orange-50 p-1.5 rounded-md">
                                            <FileText className="w-4 h-4 text-orange-600" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium text-gray-900 truncate w-32">{task.filename}</span>
                                            <span className="text-xs text-gray-500 capitalize">{task.status}...</span>
                                        </div>
                                    </div>
                                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                                </div>
                            ))}

                            {activeTasks.length === 0 && (
                                <div className="text-center py-8 border border-dashed border-gray-300 rounded-md">
                                    <p className="text-gray-400 text-sm">Queue is empty</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="xl:col-span-3">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Completed Analysis ({displayedTasks.length}{displayedTasks.length !== completedTasks.length ? ` / ${completedTasks.length}` : ''})
                            </h3>
                        </div>

                        {/* Toolbar: Search, Filter, Export */}
                        <div className="flex flex-col sm:flex-row gap-2 mb-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by candidate name..."
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                                />
                            </div>
                            <select
                                value={recommendationFilter}
                                onChange={(e) => setRecommendationFilter(e.target.value)}
                                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                            >
                                <option value="all">All Recommendations</option>
                                <option value="Strong Hire">Strong Hire</option>
                                <option value="Hire">Hire</option>
                                <option value="Caution">Caution</option>
                                <option value="Reject">Reject</option>
                            </select>
                            <button
                                onClick={() => setShowCompareModal(true)}
                                disabled={compareIds.length < 2}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:border-orange-400 hover:text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                                <GitCompare className="w-4 h-4" />
                                Compare {compareIds.length > 0 ? `(${compareIds.length})` : ''}
                            </button>
                            <button
                                onClick={exportCSV}
                                disabled={displayedTasks.length === 0}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                            <button
                                onClick={clearAll}
                                disabled={completedTasks.length === 0}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 bg-white border border-gray-300 rounded-md hover:border-rose-400 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear All
                            </button>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                    <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        <th className="px-5 py-3 w-10"></th>
                                        <th className="px-5 py-3 cursor-pointer select-none hover:text-gray-800 transition-colors" onClick={() => handleSort('name')}>
                                            Candidate{sortIndicator('name')}
                                        </th>
                                        <th className="px-5 py-3 cursor-pointer select-none hover:text-gray-800 transition-colors" onClick={() => handleSort('score')}>
                                            Match Score{sortIndicator('score')}
                                        </th>
                                        <th className="px-5 py-3 cursor-pointer select-none hover:text-gray-800 transition-colors" onClick={() => handleSort('recommendation')}>
                                            Recommendation{sortIndicator('recommendation')}
                                        </th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                    {displayedTasks.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">
                                                {completedTasks.length === 0
                                                    ? 'No results yet. Upload resumes to start the agents.'
                                                    : 'No candidates match your search/filter.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedTasks.map((task) => (
                                            <tr key={task.id} className={`transition-colors group ${compareIds.includes(task.id) ? 'bg-orange-50/50' : 'hover:bg-gray-50'}`}>
                                                <td className="px-5 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={compareIds.includes(task.id)}
                                                        onChange={() => toggleCompare(task.id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-700 font-semibold text-xs">
                                                            {task.data?.candidate_name?.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900 text-sm">{task.data?.candidate_name}</div>
                                                            <div className="text-xs text-gray-500">{task.filename}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <ScoreBadge score={task.data?.score || 0} />
                                                </td>
                                                <td className="px-5 py-3">
                                                    <RecommendationBadge rec={task.data?.final_recommendation || 'Caution'} />
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => { setSelectedCandidate(task.data); setSelectedJobDescription(task.jobDescription); }}
                                                            className="text-gray-400 hover:text-orange-600 transition-colors p-1.5 rounded-md hover:bg-orange-50"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteTask(task.id)}
                                                            className="text-gray-400 hover:text-rose-600 transition-colors p-1.5 rounded-md hover:bg-rose-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Analysis Detail Modal */}
            {selectedCandidate && (
                <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50 transition-opacity">
                    <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">{selectedCandidate.candidate_name}</h2>
                                <p className="text-sm text-gray-500 mt-1">AI Agent Analysis Report</p>
                            </div>
                            <button
                                onClick={() => { setSelectedCandidate(null); setSelectedJobDescription(null); }}
                                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-6">

                            {/* Job Description this candidate was evaluated against */}
                            {selectedJobDescription && (
                                <div className="bg-white p-5 rounded-md border border-gray-200">
                                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-gray-500" />
                                        Job Description
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed text-sm max-h-32 overflow-y-auto whitespace-pre-line">
                                        {selectedJobDescription}
                                    </p>
                                </div>
                            )}

                            {/* Summary Card */}
                            <div className="bg-gray-50 p-5 rounded-md border-l-4 border-orange-500">
                                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4 text-orange-600" />
                                    Executive Summary
                                </h3>
                                <p className="text-gray-700 leading-relaxed text-sm">
                                    {selectedCandidate.reasoning}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Strengths */}
                                <div>
                                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                        Key Strengths
                                    </h3>
                                    <ul className="space-y-2">
                                        {selectedCandidate.key_strengths?.map((s, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 p-2.5 rounded-md border border-gray-200">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                                <span>{s}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Concerns */}
                                <div>
                                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600" />
                                        Areas of Concern
                                    </h3>
                                    <ul className="space-y-2">
                                        {selectedCandidate.concerns?.map((s, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 p-2.5 rounded-md border border-gray-200">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                                <span>{s}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                            <button onClick={() => { setSelectedCandidate(null); setSelectedJobDescription(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Candidate Comparison Modal */}
            {showCompareModal && (
                <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50 transition-opacity">
                    <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Candidate Comparison</h2>
                                <p className="text-sm text-gray-500 mt-1">Comparing {compareTasks.length} candidates side by side</p>
                            </div>
                            <button
                                onClick={() => setShowCompareModal(false)}
                                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                <tr>
                                    <th className="w-32"></th>
                                    {compareTasks.map(task => (
                                        <th key={task.id} className="px-4 py-3 border-b border-gray-200 align-bottom">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-700 font-semibold text-xs shrink-0">
                                                    {task.data?.candidate_name?.charAt(0) || '?'}
                                                </div>
                                                <span className="font-semibold text-gray-900 text-sm">{task.data?.candidate_name}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr>
                                        <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide align-top">Match Score</td>
                                        {compareTasks.map(task => (
                                            <td key={task.id} className="px-4 py-3 align-top">
                                                <ScoreBadge score={task.data?.score || 0} />
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide align-top">Recommendation</td>
                                        {compareTasks.map(task => (
                                            <td key={task.id} className="px-4 py-3 align-top">
                                                <RecommendationBadge rec={task.data?.final_recommendation || 'Caution'} />
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide align-top">Summary</td>
                                        {compareTasks.map(task => (
                                            <td key={task.id} className="px-4 py-3 align-top text-sm text-gray-600 leading-relaxed">
                                                {task.data?.reasoning}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide align-top">Strengths</td>
                                        {compareTasks.map(task => (
                                            <td key={task.id} className="px-4 py-3 align-top">
                                                <ul className="space-y-1.5">
                                                    {task.data?.key_strengths?.map((s, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                                            <span>{s}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide align-top">Concerns</td>
                                        {compareTasks.map(task => (
                                            <td key={task.id} className="px-4 py-3 align-top">
                                                <ul className="space-y-1.5">
                                                    {task.data?.concerns?.map((s, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                                                            <span>{s}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                            <button
                                onClick={() => { setCompareIds([]); setShowCompareModal(false); }}
                                className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                Clear selection
                            </button>
                            <button onClick={() => setShowCompareModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Sub Components ---

function StatTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
    return (
        <div className="bg-white p-5 flex items-start justify-between">
            <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
                <p className="text-2xl font-semibold text-gray-900">{value}</p>
            </div>
            <div className="bg-orange-50 p-2 rounded-md">
                <Icon className="w-4 h-4 text-orange-600" />
            </div>
        </div>
    );
}

function ScoreBadge({ score }: { score: number }) {
    let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
    let Icon = XCircle;

    if (score >= 80) {
        colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        Icon = TrendingUp;
    } else if (score >= 60) {
        colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        Icon = AlertTriangle;
    } else {
        colorClass = "bg-rose-50 text-rose-700 border-rose-200";
    }

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold border ${colorClass}`}>
            <Icon className="w-3.5 h-3.5" />
            {score}%
        </span>
    );
}

function RecommendationBadge({ rec }: { rec: string }) {
    const map: Record<string, { text: string; styles: string }> = {
        'Strong Hire': { text: 'Strong Hire', styles: 'bg-orange-50 text-orange-700 border-orange-200' },
        'Hire': { text: 'Hire', styles: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        'Caution': { text: 'Caution', styles: 'bg-amber-50 text-amber-700 border-amber-200' },
        'Reject': { text: 'Reject', styles: 'bg-rose-50 text-rose-700 border-rose-200' },
    };

    const config = map[rec] || map['Caution'];

    return (
        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide border ${config.styles}`}>
            {config.text}
        </span>
    );
}
