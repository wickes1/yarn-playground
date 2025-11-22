// Wrapper to load dotnet.js as a module and expose it globally
import { dotnet } from './_framework/dotnet.js';

// Only expose dotnet to the global window object if not already there
if (!window.dotnet) {
    window.dotnet = dotnet;
}
