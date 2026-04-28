import React, { useState, useEffect, useRef } from 'react';
import { Editor } from './components/Editor';
import { Visualizer } from './components/Visualizer';
import { Runner } from './components/Runner';
import { useYarn } from './hooks/useYarn';
import { Play, Network, Terminal, Copy, Trash2, RotateCcw, BookOpen, Github } from 'lucide-react';
import clsx from 'clsx';
import packageJson from '../package.json';

const DEFAULT_STORY_URL = '/cafe-ordering-demo.yarn';

export default function App() {
    const { isReady, parse, parseResult, isParsing } = useYarn();
    const [source, setSource] = useState('');
    const [defaultSource, setDefaultSource] = useState('');
    const [activeTab, setActiveTab] = useState<'visualizer' | 'runner'>('visualizer');
    const editorRef = useRef<any>(null);
    const hasInitialParsed = useRef(false);

    // Load default story
    useEffect(() => {
        fetch(DEFAULT_STORY_URL)
            .then(res => res.text())
            .then(text => {
                setSource(text);
                setDefaultSource(text);
            })
            .catch(() => setSource('// Failed to load story\n// Paste your Yarn script here'));
    }, []);

    // Initial parse
    useEffect(() => {
        if (isReady && source && !hasInitialParsed.current) {
            parse(source);
            hasInitialParsed.current = true;
        }
    }, [isReady, source, parse]);

    const handleNodeClick = (nodeName: string) => {
        const lines = source.split('\n');
        const lineIdx = lines.findIndex(l => l.trim().startsWith(`title: ${nodeName}`));
        if (lineIdx !== -1 && editorRef.current) {
            const startPos = lines.slice(0, lineIdx).join('\n').length + (lineIdx > 0 ? 1 : 0);
            editorRef.current.setSelectionRange(startPos, startPos + lines[lineIdx].length);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-surface-1 text-ink overflow-hidden">
            {/* Header */}
            <header className="h-12 bg-surface-2 border-b border-border flex items-center justify-between px-5 shrink-0">
                <div className="flex items-center gap-2.5">
                    <BookOpen size={18} className="text-sepia" />
                    <h1 className="font-semibold text-base tracking-tight text-ink">
                        Yarn Playground
                    </h1>
                    <span className="text-xs text-muted ml-1">v{packageJson.version}</span>
                </div>

                <div className="flex items-center gap-3">
                    <StatusBadge isReady={isReady} />
                    <span className="w-px h-5 bg-border" aria-hidden="true" />
                    <a
                        href="https://github.com/wickes1/yarn-playground"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded text-sepia hover:text-ink hover:bg-surface-4 transition-colors"
                        title="View source on GitHub"
                        aria-label="View source on GitHub"
                    >
                        <Github size={16} />
                    </a>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 flex overflow-hidden">
                {/* Editor Panel */}
                <div className="w-1/2 flex flex-col min-w-[300px] border-r border-border">
                    <EditorToolbar
                        onCopy={() => navigator.clipboard.writeText(source)}
                        onClear={() => setSource('')}
                        onReset={() => { setSource(defaultSource); defaultSource && parse(defaultSource); }}
                        onParse={() => parse(source)}
                        isParsing={isParsing}
                        isReady={isReady}
                    />
                    <div className="flex-1 relative">
                        <Editor value={source} onChange={setSource} editorRef={editorRef} />
                    </div>
                </div>

                {/* Right Panel */}
                <div className="w-1/2 flex flex-col bg-surface-1">
                    <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
                    <div className="flex-1 relative overflow-hidden">
                        <div className="absolute inset-0">
                            {activeTab === 'visualizer' ? (
                                <Visualizer data={parseResult} onNodeClick={handleNodeClick} />
                            ) : (
                                <Runner data={parseResult} />
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// --- Components ---

function StatusBadge({ isReady }: { isReady: boolean }) {
    return (
        <div className={clsx(
            "text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium",
            isReady ? "bg-green-100 text-green-800 border border-green-300" : "bg-amber-100 text-amber-800 border border-amber-300"
        )}>
            <span className={clsx(
                "w-1.5 h-1.5 rounded-full",
                isReady ? "bg-green-500" : "bg-amber-500 animate-pulse"
            )} />
            {isReady ? 'Ready' : 'Loading...'}
        </div>
    );
}

interface EditorToolbarProps {
    onCopy: () => void;
    onClear: () => void;
    onReset: () => void;
    onParse: () => void;
    isParsing: boolean;
    isReady: boolean;
}

function EditorToolbar({ onCopy, onClear, onReset, onParse, isParsing, isReady }: EditorToolbarProps) {
    const ToolButton = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
        <button
            onClick={onClick}
            className="p-1.5 hover:bg-surface-4 rounded text-sepia hover:text-ink transition-colors"
            title={title}
        >
            {children}
        </button>
    );

    return (
        <div className="bg-surface-2 px-3 py-2 flex items-center justify-between border-b border-border">
            <div className="flex gap-1">
                <ToolButton onClick={onCopy} title="Copy"><Copy size={14} /></ToolButton>
                <ToolButton onClick={onClear} title="Clear"><Trash2 size={14} /></ToolButton>
                <ToolButton onClick={onReset} title="Reset"><RotateCcw size={14} /></ToolButton>
            </div>
            <button
                onClick={onParse}
                disabled={isParsing || !isReady}
                className={clsx(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded font-medium text-sm transition-all",
                    isParsing || !isReady
                        ? "bg-surface-4 text-muted cursor-not-allowed"
                        : "bg-sepia hover:bg-sepia/80 text-white shadow-sm"
                )}
            >
                <Play size={12} fill="currentColor" />
                {isParsing ? 'Parsing...' : 'Parse'}
            </button>
        </div>
    );
}

interface TabBarProps {
    activeTab: 'visualizer' | 'runner';
    onTabChange: (tab: 'visualizer' | 'runner') => void;
}

function TabBar({ activeTab, onTabChange }: TabBarProps) {
    const Tab = ({ id, icon: Icon, label }: { id: 'visualizer' | 'runner'; icon: any; label: string }) => (
        <button
            onClick={() => onTabChange(id)}
            className={clsx(
                "flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors border-b-2",
                activeTab === id
                    ? "border-sepia text-sepia bg-surface-3/50"
                    : "border-transparent text-muted hover:text-sepia hover:bg-surface-3/50"
            )}
        >
            <Icon size={15} /> {label}
        </button>
    );

    return (
        <div className="flex bg-surface-2 border-b border-border">
            <Tab id="visualizer" icon={Network} label="Visualizer" />
            <Tab id="runner" icon={Terminal} label="Runner" />
        </div>
    );
}
