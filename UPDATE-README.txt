Orbit update: connections to other tools (Excel/CSV, Microsoft Project, calendar, Slack/Teams, API)

1. STOP the app first (click its terminal, press Ctrl+C). Prisma cannot update while it runs on Windows.
2. Extract this zip and copy everything inside the 'orbit' folder over your project (choose 'Replace').
3. In the project folder run:   pnpm db:migrate     and type  integrations  when it asks for a name.
4. Start again:                 pnpm dev

No pnpm install is needed. Your .env files, package.json and node_modules are not touched.
