// Yarn Parser Types

export interface ParseResult {
    Success: boolean;
    Nodes: YarnNode[];
    StringTable: Record<string, string>;
    Diagnostics: Diagnostic[];
    InitialValues: Record<string, number | string | boolean>;
}

export interface YarnNode {
    Name: string;
    Headers: NodeHeader[];
    Tags: string[];
    Instructions: Instruction[];
    Lines: NodeLine[];
    Variables?: NodeVariable[];
}

export interface NodeHeader {
    Key: string;
    Value: string;
}

export interface NodeLine {
    LineId: string;
    Text: string;
    Tags: string[];
}

export interface NodeVariable {
    Name: string;
    Type: string;
    DefaultValue: any;
}

export interface Instruction {
    OpCode: string;
    Operands: Operand[];
}

export interface Operand {
    Value: any;
}

export interface Diagnostic {
    Message: string;
    Severity: string;
    Line?: number;
    Column?: number;
}
