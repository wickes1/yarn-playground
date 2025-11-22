using System;
using System.Runtime.InteropServices.JavaScript;
using DotNetJS;

namespace YarnJS;

using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Yarn;
using Yarn.Compiler;

public partial class Program
{
    public static void Main()
    {
        Console.WriteLine("Yarn Spinner Parser ready");
    }

    [Serializable]
    public class ParseResult
    {
        public bool Success { get; set; } = false;
        public List<NodeInfo> Nodes { get; set; } = new();
        public Dictionary<string, string> StringTable { get; set; } = new();
        public List<Diagnostic> Diagnostics { get; set; } = new();
        public Dictionary<string, object> InitialValues { get; set; } = new();
    }

    [Serializable]
    public class NodeInfo
    {
        public string Name { get; set; } = "";
        public List<HeaderInfo> Headers { get; set; } = new();
        public List<string> Tags { get; set; } = new();
        public List<LineInfo> Lines { get; set; } = new();
        public List<InstructionInfo> Instructions { get; set; } = new();
        public List<VariableDeclaration> Variables { get; set; } = new();
    }

    [Serializable]
    public class HeaderInfo
    {
        public string Key { get; set; } = "";
        public string Value { get; set; } = "";
    }

    [Serializable]
    public class LineInfo
    {
        public string LineId { get; set; } = "";
        public string Text { get; set; } = "";
        public List<string> Tags { get; set; } = new();
    }

    [Serializable]
    public class InstructionInfo
    {
        public string OpCode { get; set; } = "";
        public List<OperandInfo> Operands { get; set; } = new();
    }

    [Serializable]
    public class OperandInfo
    {
        public string Type { get; set; } = "";
        public object? Value { get; set; }
    }

    [Serializable]
    public class VariableDeclaration
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public object? DefaultValue { get; set; }
    }

    private static List<LineInfo> ExtractLinesFromNode(Yarn.Node node, IDictionary<string, Yarn.Compiler.StringInfo> stringTable)
    {
        var lines = new List<LineInfo>();

        if (stringTable == null)
            return lines;

        // Filter string table entries that belong to this node
        foreach (var kvp in stringTable)
        {
            var stringInfo = kvp.Value;

            // Check if this line belongs to the current node
            if (stringInfo.nodeName == node.Name)
            {
                // Parse metadata (hashtags) - they come as an array
                var tags = new List<string>();
                if (stringInfo.metadata != null && stringInfo.metadata.Length > 0)
                {
                    // Clean the tags (remove # prefix if present)
                    tags = stringInfo.metadata
                        .Select(t => t.Trim().TrimStart('#'))
                        .Where(t => !string.IsNullOrEmpty(t))
                        .ToList();
                }

                lines.Add(new LineInfo
                {
                    LineId = kvp.Key,
                    Text = stringInfo.text ?? "",
                    Tags = tags
                });
            }
        }

        return lines;
    }

    private static List<InstructionInfo> ExtractInstructions(Yarn.Node node)
    {
        var instructions = new List<InstructionInfo>();

        if (node.Instructions == null)
            return instructions;

        // List of all possible opcode types (from the JSON properties we discovered)
        var opcodeTypes = new[] {
            // Control flow
            "JumpTo", "PeekAndJump", "JumpIfFalse", "Jump", "Label",

            // Dialogue
            "RunLine", "RunCommand", "AddOption", "ShowOptions",

            // Stack operations
            "PushString", "PushFloat", "PushBool", "PushInt", "PushNull",
            "PushVariable", "StoreVariable", "Pop",

            // Arithmetic operations
            "Add", "Sub", "Mult", "Div", "Mod", "UnaryMinus",

            // Comparison operations
            "EqualTo", "GreaterThan", "LessThan",
            "GreaterThanOrEqualTo", "LessThanOrEqualTo", "NotEqualTo",

            // Logical operations
            "And", "Or", "Not", "Xor",

            // Functions and nodes
            "CallFunc", "Stop", "RunNode", "PeekAndRunNode",
            "DetourToNode", "PeekAndDetourToNode", "Return",

            // Saliency
            "AddSaliencyCandidate", "AddSaliencyCandidateFromNode", "SelectSaliencyCandidate"
        };

        foreach (var instruction in node.Instructions)
        {
            try
            {
                // Serialize the instruction to JSON
                var jsonStr = JsonSerializer.Serialize(instruction, new JsonSerializerOptions
                {
                    WriteIndented = false,
                    IncludeFields = true
                });

                using var doc = JsonDocument.Parse(jsonStr);
                var root = doc.RootElement;

                var instructionInfo = new InstructionInfo
                {
                    OpCode = "Unknown",
                    Operands = new List<OperandInfo>()
                };

                // Find which opcode property is present (protobuf oneof structure)
                foreach (var opcodeType in opcodeTypes)
                {
                    if (root.TryGetProperty(opcodeType, out var opcodeData) && opcodeData.ValueKind != JsonValueKind.Null)
                    {
                        instructionInfo.OpCode = opcodeType;

                        // Extract operands from the opcode-specific data
                        foreach (var prop in opcodeData.EnumerateObject())
                        {
                            var operandInfo = new OperandInfo();

                            if (prop.Value.ValueKind == JsonValueKind.String)
                            {
                                operandInfo.Type = "String";
                                operandInfo.Value = prop.Value.GetString();
                            }
                            else if (prop.Value.ValueKind == JsonValueKind.Number)
                            {
                                operandInfo.Type = "Number";
                                operandInfo.Value = prop.Value.GetDouble();
                            }
                            else if (prop.Value.ValueKind == JsonValueKind.True || prop.Value.ValueKind == JsonValueKind.False)
                            {
                                operandInfo.Type = "Bool";
                                operandInfo.Value = prop.Value.GetBoolean();
                            }
                            else
                            {
                                // For complex types, serialize as string
                                operandInfo.Type = prop.Name;
                                operandInfo.Value = prop.Value.ToString();
                            }

                            instructionInfo.Operands.Add(operandInfo);
                        }

                        break; // Found the opcode, stop searching
                    }
                }

                instructions.Add(instructionInfo);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error extracting instruction: {ex.Message}");
                instructions.Add(new InstructionInfo
                {
                    OpCode = "Error",
                    Operands = new List<OperandInfo>()
                });
            }
        }

        return instructions;
    }

    private static List<VariableDeclaration> ExtractVariables(Yarn.Node node)
    {
        var variables = new List<VariableDeclaration>();

        // Extract from initial values if available
        if (node.Headers != null)
        {
            foreach (var header in node.Headers)
            {
                // Look for variable declaration headers
                if (header.Key.StartsWith("$"))
                {
                    variables.Add(new VariableDeclaration
                    {
                        Name = header.Key,
                        Type = "unknown",
                        DefaultValue = header.Value
                    });
                }
            }
        }

        return variables;
    }

    [System.Runtime.InteropServices.JavaScript.JSExport]
    public static string ParseYarn(string source)
    {
        try
        {
            // Create compilation job
            CompilationJob compilationJob = CompilationJob.CreateFromString("input", source);

            // Compile the source
            var result = Compiler.Compile(compilationJob);

            ParseResult parseResult;

            if (result.Program == null)
            {
                // Compilation failed
                parseResult = new ParseResult
                {
                    Success = false,
                    Nodes = new List<NodeInfo>(),
                    StringTable = new Dictionary<string, string>(),
                    Diagnostics = result.Diagnostics.ToList()
                };
            }
            else
            {
                // Extract initial values from the compilation result
                var initialValues = result.Program?.InitialValues.ToDictionary(kv => kv.Key, kv =>
                {
                    switch (kv.Value.ValueCase)
                    {
                        case Operand.ValueOneofCase.StringValue:
                            return (object)kv.Value.StringValue;
                        case Operand.ValueOneofCase.BoolValue:
                            return (object)kv.Value.BoolValue;
                        case Operand.ValueOneofCase.FloatValue:
                            return (object)kv.Value.FloatValue;
                        default:
                            throw new Exception($"Variable {kv.Key} has a value of invalid type {kv.Value.ValueCase}");
                    }
                }) ?? new Dictionary<string, object>();

                // Compilation succeeded - build parse result
                parseResult = new ParseResult
                {
                    Success = true,
                    Nodes = result.Program.Nodes.Values.Select(n => new NodeInfo
                    {
                        Name = n.Name,
                        Headers = n.Headers.Select(h => new HeaderInfo
                        {
                            Key = h.Key,
                            Value = h.Value
                        }).ToList(),
                        Tags = n.Tags?.ToList() ?? new List<string>(),
                        Lines = ExtractLinesFromNode(n, result.StringTable),
                        Instructions = ExtractInstructions(n),
                        Variables = ExtractVariables(n)
                    }).ToList(),
                    StringTable = result.StringTable?.ToDictionary(kv => kv.Key, kv => kv.Value.text ?? "")
                        ?? new Dictionary<string, string>(),
                    Diagnostics = result.Diagnostics.ToList(),
                    InitialValues = initialValues
                };
            }

            // Serialize to JSON and return
            return JsonSerializer.Serialize(parseResult);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Parse error: {ex.Message}");
            Console.Error.WriteLine($"Stack trace: {ex.StackTrace}");
            var errorResult = new ParseResult
            {
                Success = false,
                Diagnostics = new List<Diagnostic>()
            };
            return JsonSerializer.Serialize(errorResult);
        }
    }

}
