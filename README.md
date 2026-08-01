# Flare Vault

A private portfolio ledger for Flare. Holdings are committed on-chain as a hash — not as numbers — so the network can confirm a position exists and when it was last valued, without ever seeing what's in it.

Built for the **Flare Summer Signal** hackathon (Interoperable Asset Products + Private Applications tracks).

---

## The problem

Every balance on Flare, like every balance on any public EVM chain, is visible to anyone who knows your address. There's no equivalent of a bank statement that only you can read. If you hold a diversified position across FLR, bridged BTC, and bridged XRP, that entire allocation — and its dollar value — is public information the moment someone looks up your wallet.

That's fine for a lot of use cases. It's a real problem for anyone who wants to manage a portfolio the way they'd manage a brokerage account: privately, with the option to disclose only what they choose to.

## What this does

Flare Vault splits portfolio tracking into two halves:

**A public ledger.** A smart contract (`PortfolioVault`) stores a commitment — a keccak256 hash — of your holdings, plus a timestamp. Anyone can verify a position exists and when it was last updated. Nobody can reconstruct the underlying amounts from the hash.

**A private valuation layer.** To find out what a position is actually worth, the raw holdings are handed to a Flare Confidential Compute (FCC) extension — code running inside a hardware-isolated enclave (a TEE). The enclave reads live prices from Flare's FTSOv2 oracle, computes the total, and returns only that number. The raw holdings never touch a database, a log file, or this contract's storage.

Price data itself comes from `FtsoV2Consumer`, a small contract that reads Flare's FTSOv2 feeds directly — this part needs no privacy layer, since prices are public by design; only your position in those assets is meant to stay private.

## What's live right now

Two contracts are deployed and verified working on Coston2, Flare's public testnet:

| Contract | Address | What it does |
|---|---|---|
| `FtsoV2Consumer` | [`0xE6eA788371EbB0620500b048Bae2e1A790fd464C`](https://coston2-explorer.flare.network/address/0xE6eA788371EbB0620500b048Bae2e1A790fd464C) | Reads live FLR/USD, BTC/USD, ETH/USD, XRP/USD prices from FTSOv2 |
| `PortfolioVault` | [`0x2f3C9E4C839D8a0b8DD26D2073d28c7990938723`](https://coston2-explorer.flare.network/address/0x2f3C9E4C839D8a0b8DD26D2073d28c7990938723) | Stores holdings commitments; reads through to `FtsoV2Consumer` for pricing |

`FtsoV2Consumer.getAllPrices()` has been called repeatedly during testing and returns live, changing values each time — confirmation it's pulling real oracle data, not anything hardcoded.

## What's a live demo vs. what's roadmap

Being direct about this, since it matters for anyone evaluating the project:

**Real and working today:**
- Both contracts above, deployed and callable on Coston2
- Live price reads via FTSOv2
- The commitment/hash pattern for on-chain privacy of holdings

**Demonstrated but not yet wired to real user funds:**
- The frontend (`live-demo.html`) shows sample holdings amounts, not a real committed position — because committing a real position and then valuing it privately requires the FCC extension below, which is still in progress
- The "Reveal via TEE" flow in the demo simulates the enclave round-trip (submit → compute → return) with real activity-log timestamps and a real read against `PortfolioVault`, but the actual valuation math currently runs client-side rather than inside a deployed TEE

**Roadmap — written, not yet deployed:**
- `contracts/fcc-extension/PortfolioInstructionSender.sol` and `extension-go/` contain a working skeleton for the actual Confidential Compute extension, adapted from Flare's `fce-extension-scaffold` pattern
- Flare's own documentation describes FCC as being in its final stages of development and not yet a fully public production system as of this submission — deploying the extension end-to-end requires Docker, a Go toolchain, a tunnel (ngrok/cloudflared), and indexer credentials issued directly by Flare's team
- The two interface files under `contracts/fcc-extension/interfaces/` are reconstructed from the scaffold's calling pattern rather than copied from the source repo, and are flagged as such in the code — swap in the real files from `flare-foundation/fce-extension-scaffold` before attempting to compile that part

This split is intentional: rather than fake a finished private-compute pipeline, the parts that are real are fully real and checkable on-chain, and the parts that aren't are labeled and left as an honest next step.

## Architecture

```
User's wallet
     │  commit(hash of holdings)
     ▼
PortfolioVault.sol  ──reads pricing through──▶  FtsoV2Consumer.sol ──▶ FTSOv2 (live oracle)
     │
     │  (roadmap) raw holdings, sent only to the enclave
     ▼
PortfolioInstructionSender.sol  ──▶  FCC TEE extension (Go)  ──▶  returns USD total only
```

The property that matters: raw holdings exist in exactly one place, and only for the duration of one computation — inside the enclave. Everywhere else, only a hash or a final aggregate number is ever visible.

## Repository structure

```
contracts/
  FtsoV2Consumer.sol         — live, deployed price reader
  PortfolioVault.sol         — live, deployed commitment ledger
  fcc-extension/             — roadmap: TEE-side onchain entry point
    PortfolioInstructionSender.sol
    interfaces/               — reconstructed stubs, see note above
extension-go/                — roadmap: TEE-side Go handler
scripts/deploy.js             — Hardhat deploy script (Coston2 + mainnet configs)
hardhat.config.js
frontend/
  live-demo.html               — working demo, live prices, sample holdings
README.md                     — this file
SUBMISSION.md                 — hackathon submission answers
```

## Running the live demo yourself

`frontend/live-demo.html` is a single static file with no build step and no dependencies beyond a browser:

1. Open it directly, or visit the deployed link (see submission)
2. The price ticker calls Coston2's public RPC directly (`eth_call` against `FtsoV2Consumer`) and refreshes every 6 seconds
3. No wallet connection is required to see live prices — reading a public price feed doesn't need one
4. "Reveal via TEE" walks through the intended flow described above, using the real `PortfolioVault` address

## Deploying the contracts yourself

Requires MetaMask (or any wallet) funded with test C2FLR from the [Coston2 faucet](https://faucet.flare.network/coston2).

**Via Remix (no local setup):**
1. Open [remix.ethereum.org](https://remix.ethereum.org)
2. Create `FtsoV2Consumer.sol` and `PortfolioVault.sol`, paste in the contents from `contracts/`
3. Compiler settings: Solidity `>=0.8.0 <0.9.0`, EVM version `cancun`
4. Deploy & Run → Environment → Injected Provider (MetaMask), network Coston2
5. Deploy `FtsoV2Consumer` first, then `PortfolioVault` passing the `FtsoV2Consumer` address as its constructor argument

**Via Hardhat:**
```bash
npm install
echo "DEPLOYER_PRIVATE_KEY=your_key_here" > .env
npx hardhat compile
npx hardhat run scripts/deploy.js --network coston2
```

## Why Flare

- **FTSOv2** supplies the price data this whole system depends on — a decentralized, block-latency oracle rather than a single trusted price feed
- **FAssets** (bridged BTC, XRP, DOGE) are the asset types this is built to track, since those are the positions most likely to be worth keeping private
- **Flare Confidential Compute** is the piece that makes private valuation possible without trusting a centralized server — the whole reason this is a Flare project rather than something built on any general-purpose EVM chain

## License

MIT
