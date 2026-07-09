# Workspace Handoff

## Repository

- Remote: `https://github.com/tii-mom/dugou.git`
- Local branch: `main`
- Upstream: `origin/main`
- Remote base commit: `660ef14`

## Current Policy

- Do not push yet. Other threads are still working in this workspace.
- Keep local generated files ignored.
- Review and commit all intended changes together after the other threads finish.

## Ignored Local Artifacts

The workspace intentionally ignores:

- `.env`
- `.next/`
- `.next-dev.log`
- `.next-dev.pid`
- `.pnpm-store/`
- `node_modules/`
- `tsconfig.tsbuildinfo`
- `_tmp_*`

## Notable Local Additions

- `docs/diao-ton-contract-design.md`: DIAO TON Jetton and milestone unlock contract design.
- `docs/workspace-handoff.md`: this handoff note.

## Suggested Next Steps Before Push

1. Ask other active threads to finish or pause.
2. Run `git status --short`.
3. Review changed files by feature area.
4. Run `pnpm typecheck` and `pnpm lint`.
5. Commit with a scoped message.
6. Push only after confirming no thread still has unmerged local work.
