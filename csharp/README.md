# C# WebAssembly Parser

Yarn Spinner parser compiled to WebAssembly for browser use.

## Stack

- .NET 10 Blazor WebAssembly
- Yarn Spinner 3.0.2
- DotNetJS 0.23.4

## Build

```bash
cd csharp/YarnSpinnerJS
dotnet build -c Release
```

Output: `bin/Release/net10.0/wwwroot/_framework/`

The dev script (`pnpm dev`) automatically builds and copies the framework files.

## API

```typescript
// Parse Yarn script
const result = await dotnet.YarnJS.ParseYarn(yarnScript);

// Returns: { success, nodes, stringTable, diagnostics }
```

## Files

```
YarnSpinnerJS/
├── Program.cs           # Parser implementation
└── YarnSpinnerJS.csproj # Project config
```
