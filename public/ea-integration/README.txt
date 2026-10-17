Nexus Quant - EA integration files

User account reporting:
1. Extract the archive. Copy the NexusReporter folder into MT5's MQL5/Experts folder.
2. In MT5 Tools > Options > Expert Advisors, allow WebRequest to https://nqstrategy.com.
3. Create a read-only connection in Personal center > Account activity on the website.
4. Attach NexusAccountReporter.ex5 to a spare chart. Enter ProductId, TelemetryToken,
   and the original EA's magic number. Set ConsentToReporting=true after reviewing consent.
5. The reporter never places, closes or modifies trades. It does not replace your trading EA.
6. The terminal identifier is generated automatically. Do not manually enter a device fingerprint.
7. Data is terminal-reported, not broker-verified. Reporting requires a connected terminal.

Developer runtime authorization:
NexusRuntime.mqh is the shared component. NexusAuthorizationExample.mq5 is a source
example without trading logic. It is not a ready-to-trade EA. Integrate validation into
your EA and compile it before distributing. Existing EX5 files are not modified by this package.
Enter the administrator-issued authorization code only in a compatible EA, not in the
read-only reporter's TelemetryToken field. First activation binds the account/server/terminal.
Preserve protective management of existing positions before gating new entries.
WebRequest is synchronous and does not work in the MT5 strategy tester.

Chinese instructions / 中文使用说明:
https://nqstrategy.com/ea-integration
