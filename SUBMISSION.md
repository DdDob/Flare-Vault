# Flare Summer Signal — Submission Draft

Copy these straight into the DoraHacks BUIDL submission form.

**Project name:** Flare Vault

**Selected bounty/bounties:** Interoperable Asset Products, Private Applications (Flare Confidential Compute)

**Short product description:**
Flare Vault is a privacy-first vault platform on Flare with two working products.
**Portfolio Vault** lets users commit their holdings to a hash (not raw numbers),
verify a position exists without revealing it, and interact with Flare's live
FTSOv2 price feeds and FXRP AssetManager. **Inheritance Vault** is a digital dead
man's switch: users name a beneficiary, check in periodically to prove they're
active, and encrypt a last message client-side with real AES-256-GCM. If the owner
goes silent past their chosen interval, the beneficiary can claim the vault and
decrypt the message — all enforced on-chain.

**Target user:** Two related audiences. (1) Individuals and small DAOs holding
multi-chain assets who want to prove solvency or portfolio status without
broadcasting their exact net worth. (2) Anyone holding meaningful crypto who has
no plan for what happens to it if they lose access, disappear, or die — currently
a real, unsolved gap for self-custodied assets.

**Demo link / working app link:** https://flare-vault.vercel.app/
Live, working app with two functional tabs (Portfolio Vault, Inheritance Vault)
and two labeled roadmap tabs (Whisper Market, FlareBox AI). Full test procedure
with contract addresses is in `TESTING.md` in the repo.

**GitHub repo / technical materials:** https://github.com/DdDob/Flare-Vault
Contains all deployed contracts, the live app, and detailed documentation.

**How the project uses Flare:**
- **FTSOv2** for live, decentralized USD price feeds (`contracts/FtsoV2Consumer.sol`)
- **FAssets** — dynamically resolves the live FXRP AssetManager via Flare's official
  ContractRegistry and sends a real `reserveCollateral()` transaction, the genuine
  first on-chain step of FAssets minting (`contracts/FAssetsResolver.sol`)
- **Flare Confidential Compute (FCC)** — the intended private-valuation layer for
  Portfolio Vault; contracts and Go handler written following Flare's real scaffold
  pattern, pending Flare's gated TEE infrastructure (`contracts/fcc-extension/`,
  `extension-go/`)

**What was newly built during the program:**
- `FtsoV2Consumer.sol` — deployable, real price-feed reader for 4 assets
- `PortfolioVault.sol` — on-chain commitment ledger for private positions
- `FAssetsResolver.sol` — live FXRP AssetManager resolver + real collateral
  reservation fee/agent-count reads
- `InheritanceVault.sol` — digital dead man's switch: beneficiary, check-in,
  timeout-based claim, all enforced on-chain
- `PortfolioInstructionSender.sol` + Go TEE handler — FCC extension skeleton for
  private valuation
- Full interactive frontend app: real MetaMask connection, real transactions,
  real `eth_getLogs` history, real AES-256-GCM client-side encryption

**Smart contract addresses (Coston2 testnet, chain 114):**
- `FtsoV2Consumer`: [`0xE6eA788371EbB0620500b048Bae2e1A790fd464C`](https://coston2-explorer.flare.network/address/0xE6eA788371EbB0620500b048Bae2e1A790fd464C)
- `PortfolioVault`: [`0x2f3C9E4C839D8a0b8DD26D2073d28c7990938723`](https://coston2-explorer.flare.network/address/0x2f3C9E4C839D8a0b8DD26D2073d28c7990938723)
- `InheritanceVault`: [`0x69cb44b8D4B1923c18067FD14F448c8fDC7FCE64`](https://coston2-explorer.flare.network/address/0x69cb44b8D4B1923c18067FD14F448c8fDC7FCE64)
- `FAssetsResolver`: _add your deployed address here_

**Short roadmap / next steps:**
1. Wire the Go extension's `fetchPrices` to a real `abigen` binding of
   `FtsoV2Consumer` (currently stubbed — see TODO in `extension-go/internal/extension/extension.go`)
2. Run the full FCC scaffold deploy (Docker + TEE simulation) against Coston2
3. Add `updateBeneficiary` and multi-beneficiary support to Inheritance Vault
4. Whisper Market and FlareBox AI — both depend on the same FCC infrastructure;
   documented in-app as vision, not yet built

**Deployment status:** Four contracts deployed and confirmed live on **Coston2**
(chain 114): `FtsoV2Consumer`, `PortfolioVault`, `InheritanceVault`, and
`FAssetsResolver`. All core read/write functions tested manually against the live
app — see `TESTING.md` for the full procedure. Not yet deployed to Songbird or
Flare Mainnet.
