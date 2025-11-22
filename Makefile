dev:
	lsof -ti:5173 | xargs kill -9 || true
	cd csharp/YarnSpinnerJS && dotnet build -c Release
	rm -rf public/_framework
	cp -r csharp/YarnSpinnerJS/bin/Release/net10.0/wwwroot/_framework public/
	pnpm dev
