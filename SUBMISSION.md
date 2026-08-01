# Flare Summer Signal — Submission Draft

Copy these straight into the DoraHacks BUIDL submission form.

**Project name:** Flare Vault

**Selected bounty/bounties:** Interoperable Asset Products, Private Applications (Flare Confidential Compute)

**Short product description:**
Flare Vault is a private, cross-chain portfolio tracker. Users commit their holdings
(FLR, FXRP, wrapped BTC/ETH via FAssets) to Flare as a hash, not raw numbers. Anyone
can verify a position exists and when it was last valued; only the owner can compute
its real USD value, and that computation happens inside a Flare Confidential Compute
(TEE) extension using live FTSOv2 price feeds — the raw holdings never touch a
database, a frontend server, or a block explorer.

**Target user:** Individuals and small DAOs holding multi-chain assets (via FAssets)
who want a single portfolio view without broadcasting their net worth on a public
ledger — a real gap for anyone using a transparent L1 for personal finance.

**Demo link / working app link:** `flare-vault-demo.jsx` (interactive React demo,
included in this submission) — simulates the full flow: connect wallet, view
redacted holdings, trigger a TEE reveal with live-feeling FTSO prices.

**GitHub repo / technical materials:** This project folder — `contracts/`,
`extension-go/`, `frontend/`, `scripts/`, this README.

**How the project uses Flare:**
- **FTSOv2** for live, decentralized USD price feeds (`contracts/FtsoV2Consumer.sol`)
- **FAssets** as the interoperable asset layer being tracked (FXRP shown; extendable
  to FBTC/FDOGE)
- **Flare Confidential Compute (FCC)** as the private compute layer that values
  holdings inside a TEE without ever exposing raw amounts on-chain or to the
  extension operator (`contracts/fcc-extension/`, `extension-go/`)

**What was newly built during the program:**
- `FtsoV2Consumer.sol` — deployable, real price-feed reader for 4 assets
- `PortfolioVault.sol` — on-chain commitment ledger for private positions
- `PortfolioInstructionSender.sol` + Go TEE handler — FCC extension skeleton for
  private valuation and rebalance-drift checks
- Full interactive frontend demo

**Smart contract addresses:** _fill in after running `npm run deploy:coston2`_

**Short roadmap / next steps:**
1. Wire the Go extension's `fetchPrices` to a real `abigen` binding of
   `FtsoV2Consumer` (currently stubbed — see TODO in `extension-go/internal/extension/extension.go`)
2. Run the full FCC scaffold deploy (Docker + TEE simulation) against Coston2
3. Add FAssets minting flow so users can bring real bridged BTC/XRP into the vault
4. Multi-user "approved viewer" flow so e.g. a lending protocol can verify solvency
   without seeing the portfolio breakdown

**Deployment status:** Contracts written and ready for Coston2; not yet deployed on
Coston2/Songbird/Flare Mainnet as of writing this draft — update this line once you
run the deploy script.
