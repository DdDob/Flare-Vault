# Flare Vault

A privacy-first vault platform on Flare, built for **Flare Summer Signal**
(Interoperable Asset Products + Private Applications tracks).

Two products are live and fully working today. Two more are documented as
honest, labeled roadmap concepts — not built, but designed around the same
underlying idea: Flare Confidential Compute as the privacy layer.

**Live app:** https://flare-vault.vercel.app/
**Full testing procedure with contract addresses:** see [`TESTING.md`](./TESTING.md)

---

## 1. What's actually live

### Portfolio Vault
Commit your holdings to Flare as a hash, not raw numbers. Anyone can verify a
position *exists* and *when it was last valued*; nobody can reverse the hash
back into your actual holdings. Reads live FTSOv2 prices and can resolve
Flare's real FXRP AssetManager to send a genuine first-step FAssets
`reserveCollateral()` transaction.

### Inheritance Vault
A digital dead man's switch. Name a beneficiary, check in periodically to
prove you're active. Your last message is encrypted client-side with real
AES-256-GCM before anything touches the network — only its hash goes on-chain.
If you go silent past your chosen interval, your named beneficiary can claim
the vault on-chain.

## 2. What's roadmap, clearly labeled as such

### Whisper Market (vision, not built)
Private prediction markets — betting on elections, sports, prices, or AI
outcomes with your position, stake, and strategy hidden until settlement.
Depends on the same Flare Confidential Compute infrastructure described below.

### FlareBox AI (vision, not built)
A way for companies to sell access to proprietary AI models without exposing
the model, and for users to query it without exposing their prompt — both
sides' secrets stay secret, verified by a TEE rather than by trust. Same FCC
dependency as Whisper Market.

---

## 3. What's in this folder

```
flare-vault/
├── contracts/
│   ├── FtsoV2Consumer.sol           ← real, deployed price-feed reader
│   ├── PortfolioVault.sol           ← real, deployed commitment ledger
│   ├── FAssetsResolver.sol          ← real, deployed - live FXRP AssetManager resolver
│   ├── InheritanceVault.sol         ← real, deployed - dead man's switch vault
│   └── fcc-extension/               ← ADVANCED / roadmap
│       ├── PortfolioInstructionSender.sol
│       └── interfaces/              ← stub interfaces, see warning below
├── extension-go/                    ← ADVANCED / roadmap: TEE-side handler (Go)
├── scripts/deploy.js                ← Hardhat deploy script for Coston2/Flare
├── hardhat.config.js
├── package.json
├── frontend/index.html              ← the live app (Portfolio Vault + Inheritance Vault tabs)
├── SUBMISSION.md                    ← pre-filled DoraHacks submission answers
└── TESTING.md                       ← full step-by-step testing procedure
```

---

## 4. Architecture

```
 ┌────────────────────┐   commit(hash)              ┌───────────────────────┐
 │   User's wallet /   │ ───────────────────────────▶│   PortfolioVault.sol   │
 │   frontend          │                              │   (public ledger)      │
 └────────────────────┘ ◀───────────────────────────  └───────────────────────┘
          │                                                     │ reads
          │ real reserveCollateral() tx                         ▼
          ▼                                          ┌───────────────────────┐
 ┌────────────────────┐                              │   FtsoV2Consumer      │
 │  FAssetsResolver    │──resolves live address──────▶│  → FTSOv2 oracle      │
 │  (real, deployed)   │                              └───────────────────────┘
 └────────────────────┘

 ┌────────────────────┐   createVault / checkIn      ┌───────────────────────┐
 │   User's wallet /   │ ───────────────────────────▶│  InheritanceVault.sol  │
 │   frontend          │ ◀───────────────────────────│  (real, deployed)      │
 └────────────────────┘   claim (beneficiary only)   └───────────────────────┘
          │
          │ encrypts client-side (AES-256-GCM, Web Crypto)
          ▼
   encrypted message file (downloaded, shared out-of-band with beneficiary)
```

The privacy property for Portfolio Vault: raw holdings are only ever meant to
exist in one place at valuation time — inside a Flare Confidential Compute
enclave. That piece (`fcc-extension/`, `extension-go/`) is written but not
deployed, since it depends on Flare's own gated TEE infrastructure. Everything
else in the diagram above is real and live today.

---

## 5. Deploying the contracts yourself

All four core contracts deploy the same way. `InheritanceVault.sol` and
`FAssetsResolver.sol` are the simplest to start with since they have no import
dependency headaches (`InheritanceVault` has zero external imports at all).

### Via Remix (fastest, no local setup)

1. Open [Remix](https://remix.ethereum.org), create a file per contract, paste
   in the contents from `contracts/`
2. Compiler: Solidity `>=0.8.0 <0.9.0`, EVM version `cancun`
3. Add MetaMask to Flare Testnet Coston2:
   - RPC: `https://coston2-api.flare.network/ext/C/rpc`
   - Chain ID: `114`
   - Get free test funds: <https://faucet.flare.network/coston2>
4. Compile, then **Deploy & Run → Injected Provider - MetaMask → Deploy**
5. For `PortfolioVault.sol` and `FAssetsResolver.sol`'s dependent contracts,
   deploy `FtsoV2Consumer.sol` first and pass its address to the constructor
   where required

### Via Hardhat

```bash
cd flare-vault
npm install
echo "DEPLOYER_PRIVATE_KEY=your_key_here" > .env
npx hardhat compile
npx hardhat run scripts/deploy.js --network coston2
```

### Verify it worked

Call `getAllPrices()` on `FtsoV2Consumer`, or `getVault(yourAddress)` on
`InheritanceVault`, from the block explorer's "Read Contract" tab — you should
see live data.

---

## 6. Run the app

`frontend/index.html` is a self-contained static app — no build step, no
framework:

- Real MetaMask wallet connection, with automatic Coston2 network prompt
- **Portfolio Vault tab:** live prices, commit/verify/viewer-approval, real
  `eth_getLogs` history, real FAssets `reserveCollateral()` transaction
- **Inheritance Vault tab:** real AES-256-GCM encryption, real vault creation,
  live on-chain countdown, real check-in and claim transactions
- **Whisper Market / FlareBox AI tabs:** static, clearly labeled vision cards

Full step-by-step testing procedure with all contract addresses: see
[`TESTING.md`](./TESTING.md).

---

## 7. Attempting the FCC extension (advanced, optional)

If you want to go further than what's built:

1. Clone Flare's real scaffold: `git clone https://github.com/flare-foundation/fce-extension-scaffold`
2. Replace its Hello World `OPType`/`OPCommand` files with the versions in
   `contracts/fcc-extension/` and `extension-go/` from this project
3. **Important:** the two interface files under
   `contracts/fcc-extension/interfaces/` are reconstructed from the scaffold's
   usage pattern, not copied from Flare's repo directly — swap in the real
   `ITeeExtensionRegistry.sol` / `ITeeMachineRegistry.sol` before compiling
4. Follow Flare's own guide: <https://dev.flare.network/fcc/guides/getting-started>
   — covers `.env` setup, exposing a local proxy via ngrok/cloudflared,
   requesting indexer DB credentials from Flare support, and the one-shot
   deploy script
5. In `extension-go/internal/extension/extension.go`, replace the
   `fetchPrices` TODO with a real `abigen`-generated binding for
   `FtsoV2Consumer`

This is genuinely the hardest part — FCC is brand new and Flare gates the
indexer credentials through their support team. Submitting with everything
else fully working and this documented as roadmap is a normal, defensible
position for a hackathon judged partly on realistic scope.

---

## 8. Submission checklist

- [x] Project name, bounty, description, target user — see `SUBMISSION.md`
- [x] Demo link — https://flare-vault.vercel.app/
- [x] GitHub repo — this repository
- [x] Explanation of Flare usage and what was newly built — see `SUBMISSION.md`
- [x] Smart contract addresses — see `SUBMISSION.md` and `TESTING.md`
- [x] Roadmap — see `SUBMISSION.md`
- [x] Deployed on Coston2 — four contracts live, addresses in `TESTING.md`
- [ ] Demo video — record following the flow in `TESTING.md`
- [ ] User acquisition/testing notes — optional, add if you show it to anyone

**Timeline reminder:** final submission deadline is **August 14**; judging runs
August 15–21; winners announced August 24.
