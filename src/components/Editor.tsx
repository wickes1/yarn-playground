import React, { useRef, useImperativeHandle } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

interface EditorProps {
    value: string;
    onChange: (value: string) => void;
    editorRef?: React.RefObject<any>;
}

export function Editor({ value, onChange, editorRef }: EditorProps) {
    const monacoRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        monacoRef.current = editor;

        // Register Yarn language
        monaco.languages.register({ id: 'yarn' });

        // Yarn syntax highlighting
        monaco.languages.setMonarchTokensProvider('yarn', {
            tokenizer: {
                root: [
                    [/\/\/.*$/, 'comment'],
                    [/^title:/, 'keyword'],
                    [/^tags:/, 'keyword'],
                    [/^position:/, 'keyword'],
                    [/^colorID:/, 'keyword'],
                    [/^===/, 'delimiter'],
                    [/^---/, 'delimiter'],
                    [/<</, { token: 'delimiter.bracket', next: '@command' }],
                    [/^->/, 'keyword'],
                    [/^[A-Za-z]+:/, 'type'],
                    [/Jump:/, 'keyword'],
                    [/jump/, 'keyword'],
                ],
                command: [
                    [/>>/, { token: 'delimiter.bracket', next: '@pop' }],
                    [/set|declare|if|else|elseif|endif|jump|minigame|addVocabulary|addConfidence|unlockAchievement/, 'keyword'],
                    [/\$[a-zA-Z_][a-zA-Z0-9_]*/, 'variable'],
                    [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
                    [/[0-9]+/, 'number'],
                    [/"([^"\\]|\\.)*$/, 'string.invalid'],
                    [/"/, 'string', '@string'],
                ],
                string: [
                    [/[^\\"]+/, 'string'],
                    [/"/, 'string', '@pop']
                ]
            }
        });

        // Vintage Paper light theme
        monaco.editor.defineTheme('yarn-manuscript', {
            base: 'vs',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '8b7355' },
                { token: 'keyword', foreground: 'a67c52' },
                { token: 'delimiter', foreground: 'c4a77d' },
                { token: 'delimiter.bracket', foreground: '8b5a2b' },
                { token: 'type', foreground: '6b4423' },
                { token: 'variable', foreground: 'a67c52' },
                { token: 'string', foreground: '5a7247' },
                { token: 'number', foreground: 'b06030' },
            ],
            colors: {
                'editor.background': '#f8f5f0',
                'editor.foreground': '#4a3f35',
                'editorLineNumber.foreground': '#c4a77d',
                'editorLineNumber.activeForeground': '#8b5a2b',
                'editor.lineHighlightBackground': '#f0ebe3',
                'editorCursor.foreground': '#a67c52',
                'editor.selectionBackground': '#d4c4a880',
                'editor.inactiveSelectionBackground': '#e8e0d480',
                'editorWidget.background': '#f0ebe3',
                'editorWidget.border': '#d4c4a8',
                'editorSuggestWidget.background': '#f0ebe3',
                'editorSuggestWidget.border': '#d4c4a8',
                'input.background': '#f8f5f0',
                'input.border': '#d4c4a8',
                'scrollbarSlider.background': '#c4a77d60',
                'scrollbarSlider.hoverBackground': '#a67c5280',
            }
        });

        monaco.editor.setTheme('yarn-manuscript');
    };

    useImperativeHandle(editorRef, () => ({
        focus: () => monacoRef.current?.focus(),
        scrollTop: 0,
        setSelectionRange: (start: number, end: number) => {
            if (!monacoRef.current) return;
            const model = monacoRef.current.getModel();
            if (!model) return;

            const startPos = model.getPositionAt(start);
            const endPos = model.getPositionAt(end);

            monacoRef.current.setSelection({
                startLineNumber: startPos.lineNumber,
                startColumn: startPos.column,
                endLineNumber: endPos.lineNumber,
                endColumn: endPos.column
            });
            monacoRef.current.revealLineInCenter(startPos.lineNumber);
        }
    }));

    return (
        <div className="h-full bg-surface-1">
            <MonacoEditor
                height="100%"
                defaultLanguage="yarn"
                value={value}
                onChange={(v) => onChange(v || '')}
                onMount={handleEditorDidMount}
                theme="yarn-manuscript"
                loading={
                    <div className="flex items-center justify-center h-full bg-surface-1 text-muted">
                        Loading editor...
                    </div>
                }
                options={{
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Consolas', 'Monaco', monospace",
                    lineNumbers: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    tabSize: 4,
                    insertSpaces: true,
                    renderWhitespace: 'selection',
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    padding: { top: 12, bottom: 12 },
                }}
            />
        </div>
    );
}
