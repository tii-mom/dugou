# DIAO / Dugou

DIAO project frontend, backend integration notes, and TON Jetton contract workspace.

## Development

Run the frontend development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

TON contract work lives in `contracts/`.

## Useful Commands

```bash
pnpm typecheck
pnpm lint
pnpm build
```

For contract build and tests:

```bash
cd contracts
npx blueprint build --all
npm test -- --runInBand
```
