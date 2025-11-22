import React, { useEffect, useRef } from 'react';
import { ParseResult } from '../types';
import { useYarnRunner } from '../hooks/useYarnRunner';
import { Play, RotateCcw } from 'lucide-react';

interface RunnerProps {
    data: ParseResult | null;
}

export function Runner({ data }: RunnerProps) {
    const {
        currentNodeName,
        currentNodeTags,
        currentLine,
        options,
        isFinished,
        waitingForContinue,
        history,
        variables,
        advance,
        reset,
        selectOption
    } = useYarnRunner(data);

    const historyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (data && !currentNodeName) reset();
    }, [data, currentNodeName, reset]);

    useEffect(() => {
        historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
    }, [history, currentLine]);

    if (!data) {
        return (
            <div className="h-full flex items-center justify-center text-muted">
                <p>No parsed data available</p>
            </div>
        );
    }

    return (
        <div className="h-full flex bg-surface-1">
            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <Header onReset={reset} />
                <DialogueArea
                    ref={historyRef}
                    history={history}
                    currentLine={currentLine}
                    isFinished={isFinished}
                    onReset={reset}
                />
                <Controls
                    options={options}
                    waitingForContinue={waitingForContinue}
                    isFinished={isFinished}
                    onAdvance={advance}
                    onSelectOption={selectOption}
                    onReset={reset}
                />
            </div>

            {/* Sidebar */}
            <Sidebar
                nodeName={currentNodeName}
                nodeTags={currentNodeTags}
                variables={variables}
            />
        </div>
    );
}

function Header({ onReset }: { onReset: () => void }) {
    return (
        <div className="flex items-center justify-between px-4 py-2 bg-surface-2 border-b border-border">
            <span className="text-xs font-semibold text-sepia uppercase tracking-wider flex items-center gap-2">
                <Play size={12} className="text-sepia" /> Story Runner
            </span>
            <button
                onClick={onReset}
                className="p-1.5 hover:bg-surface-4 rounded text-sepia hover:text-ink transition-colors"
                title="Restart"
            >
                <RotateCcw size={14} />
            </button>
        </div>
    );
}

interface DialogueAreaProps {
    history: { character?: string; text: string }[];
    currentLine: { id: string; text: string; character?: string; tags?: string[] } | null;
    isFinished: boolean;
    onReset: () => void;
}

const DialogueArea = React.forwardRef<HTMLDivElement, DialogueAreaProps>(
    ({ history, currentLine, isFinished, onReset }, ref) => (
        <div ref={ref} className="flex-1 overflow-auto p-5 space-y-4">
            {/* History */}
            {history.slice(0, -1).map((entry, i) => (
                <div key={i} className="text-muted text-sm">
                    {entry.character && <span className="font-semibold mr-2">{entry.character}:</span>}
                    <span>{entry.text}</span>
                </div>
            ))}

            {/* Current Line */}
            {!isFinished && currentLine && (
                <div className="bg-surface-3 p-4 rounded-lg border border-sepia-light shadow-sm animate-slide-up">
                    {currentLine.character && (
                        <div className="text-sepia font-semibold text-sm mb-1.5">{currentLine.character}</div>
                    )}
                    <div className="text-lg text-ink leading-relaxed">{currentLine.text}</div>
                    {currentLine.tags?.length ? (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {currentLine.tags.map((tag, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-sepia/10 text-sepia border border-sepia/20 rounded">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            )}

            {/* End State */}
            {isFinished && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                    <div className="text-2xl font-serif text-sepia mb-2">The End</div>
                    <div className="text-muted text-sm">Thank you for playing</div>
                </div>
            )}
        </div>
    )
);

interface ControlsProps {
    options: { id: number; text: string; destinationNode: string }[];
    waitingForContinue: boolean;
    isFinished: boolean;
    onAdvance: () => void;
    onSelectOption: (opt: { id: number; text: string; destinationNode: string }) => void;
}

function Controls({ options, waitingForContinue, isFinished, onAdvance, onSelectOption, onReset }: ControlsProps & { onReset: () => void }) {
    // Hide controls entirely when finished
    if (isFinished) {
        return (
            <div className="p-4 bg-surface-2 border-t border-border">
                <button
                    onClick={onReset}
                    className="w-full py-3 bg-sepia hover:bg-sepia/80 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                    Start Again
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 bg-surface-2 border-t border-border">
            {options.length > 0 ? (
                <div className="space-y-2">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => onSelectOption(opt)}
                            className="w-full text-left p-3 bg-surface-1 hover:bg-surface-3 text-ink rounded-lg transition-colors flex items-center group border border-sepia-light hover:border-sepia"
                        >
                            <span className="w-6 h-6 rounded-full bg-sepia/10 group-hover:bg-sepia/20 flex items-center justify-center text-xs mr-3 text-sepia font-medium transition-colors">
                                {opt.id + 1}
                            </span>
                            <span className="group-hover:text-sepia transition-colors">{opt.text}</span>
                        </button>
                    ))}
                </div>
            ) : waitingForContinue ? (
                <button
                    onClick={onAdvance}
                    className="w-full py-3 bg-sepia hover:bg-sepia/80 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                    Continue...
                </button>
            ) : (
                <div className="text-center text-sepia text-sm italic py-2">Processing...</div>
            )}
        </div>
    );
}

interface SidebarProps {
    nodeName: string | null;
    nodeTags: string[];
    variables: Record<string, any>;
}

function Sidebar({ nodeName, nodeTags, variables }: SidebarProps) {
    return (
        <div className="w-64 border-l border-border bg-surface-2 flex flex-col">
            {/* Node Info */}
            <div className="bg-surface-3 px-3 py-2 border-b border-border">
                <h3 className="text-xs font-semibold text-sepia uppercase tracking-wider">Current Node</h3>
            </div>
            <div className="p-3 border-b border-border bg-surface-1">
                {nodeName ? (
                    <div className="space-y-2">
                        <div className="text-sm text-ink font-medium">{nodeName}</div>
                        {nodeTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {nodeTags.map((tag, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 bg-sepia/10 text-sepia rounded border border-sepia/20">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-xs text-muted italic">No node loaded</div>
                )}
            </div>

            {/* Variables */}
            <div className="bg-surface-3 px-3 py-2 border-b border-border">
                <h3 className="text-xs font-semibold text-sepia uppercase tracking-wider">Variables</h3>
            </div>
            <div className="flex-1 overflow-auto p-3 bg-surface-1">
                {Object.keys(variables).length > 0 ? (
                    <div className="space-y-3">
                        {Object.entries(variables).map(([key, value]) => (
                            <VariableDisplay key={key} name={key} value={value} />
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-muted italic">No variables</div>
                )}
            </div>
        </div>
    );
}

function VariableDisplay({ name, value }: { name: string; value: any }) {
    const colorClass = typeof value === 'boolean'
        ? (value ? 'text-green-700' : 'text-red-700')
        : typeof value === 'number'
            ? 'text-amber-700'
            : 'text-sepia';

    const displayValue = typeof value === 'boolean'
        ? value.toString()
        : typeof value === 'string'
            ? `"${value}"`
            : value;

    return (
        <div>
            <div className="text-muted font-mono text-xs">{name}</div>
            <div className={`text-sm mt-0.5 font-semibold ${colorClass}`}>{displayValue}</div>
        </div>
    );
}
