import { useState, useCallback, useRef } from 'react';
import { ParseResult } from '../types';

export interface DialogueLine {
    id: string;
    text: string;
    character?: string;
    tags?: string[];
}

export interface DialogueOption {
    id: number;
    text: string;
    destinationNode: string;
}

export interface HistoryEntry {
    character?: string;
    text: string;
}

interface VMState {
    node: any;
    instructionIndex: number;
    instructions: any[];
    variables: Record<string, any>;
    stack: any[];
}

export interface YarnRunnerState {
    currentNodeName: string | null;
    currentNodeTags: string[];
    currentLine: DialogueLine | null;
    options: DialogueOption[];
    isFinished: boolean;
    waitingForContinue: boolean;
    history: HistoryEntry[];
    variables: Record<string, any>;
}

export function useYarnRunner(data: ParseResult | null) {
    const [state, setState] = useState<YarnRunnerState>({
        currentNodeName: null,
        currentNodeTags: [],
        currentLine: null,
        options: [],
        isFinished: false,
        waitingForContinue: false,
        history: [],
        variables: {}
    });

    const vmRef = useRef<VMState>({
        node: null,
        instructionIndex: 0,
        instructions: [],
        variables: {},
        stack: []
    });

    const loadNodeRef = useRef<((nodeName: string) => void) | undefined>(undefined);
    const advanceRef = useRef<(() => void) | undefined>(undefined);

    const getStartNode = useCallback(() => {
        if (!data?.Nodes?.length) return null;
        return (data.Nodes.find(n => n.Name === 'Start') || data.Nodes[0]).Name;
    }, [data]);

    // Execute a single VM operation - returns true if should continue processing
    const executeOp = useCallback((instr: any, vm: VMState): boolean => {
        const opCode = instr.OpCode;

        // Stack operations
        if (opCode === 'PushString' || opCode === 'PushFloat' || opCode === 'PushInt' || opCode === 'PushBool') {
            vm.stack.push(instr.Operands[0]?.Value);
            return true;
        }
        if (opCode === 'PushNull') {
            vm.stack.push(null);
            return true;
        }
        if (opCode === 'PushVariable') {
            vm.stack.push(vm.variables[instr.Operands[0]?.Value] ?? 0);
            return true;
        }
        if (opCode === 'StoreVariable') {
            const varName = instr.Operands[0]?.Value;
            const value = vm.stack.pop();
            if (varName !== undefined && value !== undefined) {
                vm.variables[varName] = value;
            }
            return true;
        }
        if (opCode === 'Pop') {
            vm.stack.pop();
            return true;
        }
        if (opCode === 'Label') {
            return true;
        }

        // Arithmetic & logic operations
        if (opCode === 'CallFunc') {
            return executeCallFunc(instr, vm);
        }

        return false;
    }, []);

    const executeCallFunc = useCallback((instr: any, vm: VMState): boolean => {
        const funcName = instr.Operands[0]?.Value || '';
        vm.stack.pop(); // Pop param count
        const op = funcName.includes('.') ? funcName.split('.').pop() : funcName;

        const ops: Record<string, () => void> = {
            'Add': () => { const b = vm.stack.pop() ?? 0; const a = vm.stack.pop() ?? 0; vm.stack.push(a + b); },
            'Minus': () => { const b = vm.stack.pop() ?? 0; const a = vm.stack.pop() ?? 0; vm.stack.push(a - b); },
            'Multiply': () => { const b = vm.stack.pop() ?? 0; const a = vm.stack.pop() ?? 0; vm.stack.push(a * b); },
            'Divide': () => { const b = vm.stack.pop() ?? 1; const a = vm.stack.pop() ?? 0; vm.stack.push(a / b); },
            'Modulo': () => { const b = vm.stack.pop() ?? 1; const a = vm.stack.pop() ?? 0; vm.stack.push(a % b); },
            'UnaryMinus': () => { vm.stack.push(-(vm.stack.pop() ?? 0)); },
            'EqualTo': () => { vm.stack.push(vm.stack.pop() === vm.stack.pop()); },
            'NotEqualTo': () => { vm.stack.push(vm.stack.pop() !== vm.stack.pop()); },
            'GreaterThan': () => { const b = vm.stack.pop() ?? 0; const a = vm.stack.pop() ?? 0; vm.stack.push(a > b); },
            'LessThan': () => { const b = vm.stack.pop() ?? 0; const a = vm.stack.pop() ?? 0; vm.stack.push(a < b); },
            'GreaterThanOrEqualTo': () => { const b = vm.stack.pop() ?? 0; const a = vm.stack.pop() ?? 0; vm.stack.push(a >= b); },
            'LessThanOrEqualTo': () => { const b = vm.stack.pop() ?? 0; const a = vm.stack.pop() ?? 0; vm.stack.push(a <= b); },
            'And': () => { vm.stack.push((vm.stack.pop() ?? false) && (vm.stack.pop() ?? false)); },
            'Or': () => { vm.stack.push((vm.stack.pop() ?? false) || (vm.stack.pop() ?? false)); },
            'Xor': () => { const b = vm.stack.pop() ?? false; const a = vm.stack.pop() ?? false; vm.stack.push((a || b) && !(a && b)); },
            'Not': () => { vm.stack.push(!(vm.stack.pop() ?? false)); }
        };

        if (ops[op]) ops[op]();
        return true;
    }, []);

    loadNodeRef.current = (nodeName: string) => {
        if (!data) return;
        const node = data.Nodes.find(n => n.Name === nodeName);
        if (!node) {
            setState(prev => ({ ...prev, isFinished: true }));
            return;
        }

        const existingVariables = vmRef.current.variables;
        let startIndex = 0;

        // Skip initial declarations on first node
        if (!vmRef.current.node && nodeName === getStartNode()) {
            while (startIndex < node.Instructions.length) {
                const instr = node.Instructions[startIndex];
                if (['RunLine', 'AddOption', 'ShowOptions', 'JumpTo', 'JumpIfFalse'].includes(instr.OpCode)) break;
                if (['PushFloat', 'PushInt', 'PushBool', 'PushString'].includes(instr.OpCode)) {
                    if (node.Instructions[startIndex + 1]?.OpCode === 'StoreVariable') {
                        startIndex += 2;
                        continue;
                    }
                }
                startIndex++;
            }
        }

        vmRef.current = {
            node,
            instructionIndex: startIndex,
            instructions: node.Instructions,
            variables: existingVariables,
            stack: []
        };

        setState(prev => ({
            ...prev,
            currentNodeName: nodeName,
            currentNodeTags: node.Tags || [],
            isFinished: false,
            options: [],
            waitingForContinue: false
        }));

        setTimeout(() => advanceRef.current?.(), 0);
    };

    advanceRef.current = () => {
        const vm = vmRef.current;
        if (!vm.node || !data) return;

        while (vm.instructionIndex < vm.instructions.length) {
            const instr = vm.instructions[vm.instructionIndex];

            // Handle dialogue line
            if (instr.OpCode === 'RunLine') {
                const lineId = instr.Operands[0].Value;
                const lineText = data.StringTable[lineId] || '';
                const [character, ...rest] = lineText.includes(': ') ? lineText.split(': ') : [undefined, lineText];
                const text = character ? rest.join(': ') : lineText;
                const lineInfo = vm.node.Lines?.find((l: any) => l.LineId === lineId);

                const line: DialogueLine = { id: lineId, text, character, tags: lineInfo?.Tags || [] };

                vm.instructionIndex++;
                setState(prev => ({
                    ...prev,
                    currentLine: line,
                    history: [...prev.history, { character, text }],
                    waitingForContinue: true,
                    variables: { ...vm.variables }
                }));
                return;
            }

            // Handle options
            if (instr.OpCode === 'AddOption') {
                const foundOptions: DialogueOption[] = [];
                let optIdx = vm.instructionIndex;
                let showIdx = -1;

                while (optIdx < vm.instructions.length) {
                    const curr = vm.instructions[optIdx];
                    if (curr.OpCode === 'AddOption') {
                        const lineId = curr.Operands[0].Value;
                        foundOptions.push({
                            id: foundOptions.length,
                            text: data.StringTable[lineId] || '',
                            destinationNode: curr.Operands[1].Value
                        });
                    } else if (curr.OpCode === 'ShowOptions') {
                        showIdx = optIdx;
                        break;
                    }
                    optIdx++;
                }

                vm.instructionIndex = showIdx >= 0 ? showIdx + 1 : optIdx;
                setState(prev => ({
                    ...prev,
                    options: foundOptions,
                    waitingForContinue: false,
                    currentLine: null,
                    variables: { ...vm.variables }
                }));
                return;
            }

            // Handle jumps
            if (instr.OpCode === 'JumpTo') {
                const dest = instr.Operands[0].Value;
                const destNum = typeof dest === 'number' ? dest : parseInt(dest, 10);
                if (!isNaN(destNum)) {
                    vm.instructionIndex = destNum;
                    continue;
                }
                loadNodeRef.current?.(dest);
                return;
            }

            if (instr.OpCode === 'RunNode') {
                loadNodeRef.current?.(instr.Operands[0].Value);
                return;
            }

            if (instr.OpCode === 'PeekAndJump') {
                const jumpDest = vm.stack.pop();
                if (typeof jumpDest === 'number') {
                    vm.instructionIndex = jumpDest;
                    continue;
                }
                vm.instructionIndex++;
                continue;
            }

            if (instr.OpCode === 'Stop') {
                setState(prev => ({ ...prev, isFinished: true }));
                return;
            }

            if (instr.OpCode === 'JumpIfFalse') {
                const condition = vm.stack.pop();
                const label = instr.Operands[0]?.Value;
                if (!condition) {
                    const labelIdx = vm.instructions.findIndex(i => i.OpCode === 'Label' && i.Operands[0]?.Value === label);
                    if (labelIdx >= 0) {
                        vm.instructionIndex = labelIdx;
                        continue;
                    }
                }
                vm.instructionIndex++;
                continue;
            }

            if (instr.OpCode === 'Jump') {
                const label = instr.Operands[0]?.Value;
                const labelIdx = vm.instructions.findIndex(i => i.OpCode === 'Label' && i.Operands[0]?.Value === label);
                if (labelIdx >= 0) {
                    vm.instructionIndex = labelIdx;
                    continue;
                }
                vm.instructionIndex++;
                continue;
            }

            // Try executing as a simple operation
            if (executeOp(instr, vm)) {
                vm.instructionIndex++;
                continue;
            }

            vm.instructionIndex++;
        }

        setState(prev => ({ ...prev, isFinished: true }));
    };

    const advance = useCallback(() => advanceRef.current?.(), []);
    const loadNode = useCallback((name: string) => loadNodeRef.current?.(name), []);

    const reset = useCallback(() => {
        const initialVars = { ...(data?.InitialValues || {}) };
        vmRef.current = {
            node: null,
            instructionIndex: 0,
            instructions: [],
            variables: initialVars,
            stack: []
        };

        setState({
            currentNodeName: null,
            currentNodeTags: [],
            currentLine: null,
            options: [],
            isFinished: false,
            waitingForContinue: false,
            history: [],
            variables: initialVars
        });

        const startNode = getStartNode();
        if (startNode) setTimeout(() => loadNodeRef.current?.(startNode), 0);
    }, [data, getStartNode]);

    const selectOption = useCallback((option: DialogueOption) => {
        const destNum = parseInt(option.destinationNode, 10);
        setState(prev => ({ ...prev, options: [], currentLine: null }));

        if (!isNaN(destNum)) {
            vmRef.current.stack.push(destNum);
            setTimeout(() => advanceRef.current?.(), 0);
        } else {
            loadNode(option.destinationNode);
        }
    }, [loadNode]);

    return {
        ...state,
        advance,
        reset,
        selectOption,
        getStartNode
    };
}
