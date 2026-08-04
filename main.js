/* ---------------- WalletConnect / Reown AppKit (real "Scan QR" connection) ---------------- */
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain } from '@reown/appkit/networks';

// Get your own free Project ID at https://dashboard.reown.com and replace this.
const REOWN_PROJECT_ID = '39f942da02509788261b1fc48c324bc5';

const coston2Network = defineChain({
  id: 114,
  caipNetworkId: 'eip155:114',
  chainNamespace: 'eip155',
  name: 'Flare Testnet Coston2',
  nativeCurrency: { decimals: 18, name: 'Coston2 Flare', symbol: 'C2FLR' },
  rpcUrls: { default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] } },
  blockExplorers: { default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' } },
  testnet: true,
});

let appKitModal = null;
try {
  appKitModal = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [coston2Network],
    projectId: REOWN_PROJECT_ID,
    metadata: {
      name: 'Flare Vault',
      description: 'Privacy-first vaults on Flare',
      url: window.location.origin,
      icons: [],
    },
    features: { analytics: false },
  });
} catch (e) {
  console.warn('AppKit did not initialize — "Scan QR" will be unavailable until a valid Project ID is set.', e);
}

/* ---------------- Config ---------------- */
const RPC_URL = "https://coston2-api.flare.network/ext/C/rpc";
const FTSO_CONSUMER = "0xE6eA788371EbB0620500b048Bae2e1A790fd464C";
const PORTFOLIO_VAULT = "0x2f3C9E4C839D8a0b8DD26D2073d28c7990938723";
const COSTON2_CHAIN_ID_HEX = "0x72"; // 114

const SEL_GET_ALL_PRICES = "445df9d6";
const SEL_HAS_POSITION = "1334becc";
const SEL_COMMIT_POSITION = "05d8296e";
const SEL_VERIFY_COMMITMENT = "95509335";
const SEL_SET_VIEWER_APPROVAL = "cf5cf568";

// InheritanceVault (real, standalone contract - no external Flare imports needed)
const SEL_IV_CREATE_VAULT = "6e3fb68b";      // createVault(address,uint64,bytes32)
const SEL_IV_CHECKIN = "183ff085";            // checkIn()
const SEL_IV_CLAIM = "1e83409a";              // claim(address)
const SEL_IV_GET_VAULT = "0eb9af38";          // getVault(address)
const SEL_IV_TIME_REMAINING = "4c2d34b3";     // timeRemaining(address)
let ivContractAddr = null;
let ivLastCiphertextBlob = null;
let ivLastHash = null;
let ivCountdownTarget = null; // unix seconds when vault unlocks, for live countdown
let ivIntervalTotal = null; // total check-in interval in seconds, for urgency color coding
const EXPLORER_BASE = "https://coston2-explorer.flare.network";

// keccak256("PositionCommitted(address,bytes32,uint64)") / keccak256("ViewerApprovalChanged(address,address,bool)")
const TOPIC_POSITION_COMMITTED = "0x8314cbfea2e73405ccfbe64a8a69220f7c5746b7c925e0cfdd0ad9ba1af98d9c";
const TOPIC_VIEWER_APPROVAL_CHANGED = "0xeaf4d2e510567f4b25dad90efca39a86b7144279d27c3ce30158d59ad9f2d055";

// FAssets (real FXRP AssetManager, resolved dynamically per Flare's own guidance)
// -- On our own FAssetsResolver.sol wrapper contract:
const SEL_GET_ASSET_MANAGER_ADDRESS = "0c17c629";   // getAssetManagerAddress()
const SEL_GET_AVAILABLE_AGENT_COUNT = "11ee97c1";   // getAvailableAgentCount()
const SEL_GET_COLLATERAL_RESERVATION_FEE = "92ffb359"; // getCollateralReservationFee(uint256)
// -- Direct calls to the real, live IAssetManager (address resolved above):
const SEL_GET_AVAILABLE_AGENTS_LIST = "e415339c";   // getAvailableAgentsList(uint256,uint256)
const SEL_RESERVE_COLLATERAL = "275a7bfc";          // reserveCollateral(address,uint256,uint256,address)
const ZERO_ADDRESS = "0000000000000000000000000000000000000000";
let resolverAddr = null;
let resolvedAssetManager = null;
let firstAgentVault = null;
let lastCRFee = null;

const FEEDS = ["FLR/USD", "BTC/USD", "ETH/USD", "XRP/USD"];
const FEED_ASSET_MAP = { FLR: 0, FBTC: 1, WETH: 2, FXRP: 3 };

let latestPrices = null;
let account = null;
let currentChainId = null;
let activeProvider = null; // whichever EIP-1193 provider is currently connected - window.ethereum or the WalletConnect session

/* ---------------- Tiny Keccak-256 (pure JS, BigInt) ---------------- */
const RC = [
  0x0000000000000001n,0x0000000000008082n,0x800000000000808An,0x8000000080008000n,
  0x000000000000808Bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,
  0x000000000000008An,0x0000000000000088n,0x0000000080008009n,0x000000008000000An,
  0x000000008000808Bn,0x800000000000008Bn,0x8000000000008089n,0x8000000000008003n,
  0x8000000000008002n,0x8000000000000080n,0x000000000000800An,0x800000008000000An,
  0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n
];
const R = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
const MASK64 = (1n<<64n)-1n;
function rotl(x,n){ n=BigInt(n%64n?n%64n:0n); n=BigInt(Number(n)%64); return ((x<<n)|(x>>(64n-n)))&MASK64; }
function keccakF(state){
  for(let round=0; round<24; round++){
    const C=[]; for(let x=0;x<5;x++) C.push(state[x][0]^state[x][1]^state[x][2]^state[x][3]^state[x][4]);
    const D=[]; for(let x=0;x<5;x++) D.push(C[(x+4)%5]^rotl(C[(x+1)%5],1n));
    for(let x=0;x<5;x++) for(let y=0;y<5;y++) state[x][y]^=D[x];
    const B=[[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n]];
    for(let x=0;x<5;x++) for(let y=0;y<5;y++) B[y][(2*x+3*y)%5]=rotl(state[x][y],BigInt(R[x][y]));
    for(let x=0;x<5;x++) for(let y=0;y<5;y++) state[x][y]=B[x][y]^((~B[(x+1)%5][y])&B[(x+2)%5][y])&MASK64;
    state[0][0]^=RC[round];
  }
  return state;
}
function keccak256Bytes(bytes){
  const rateBytes=136;
  let state=[[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n],[0n,0n,0n,0n,0n]];
  let data=Array.from(bytes);
  let padLen=rateBytes-(data.length%rateBytes); if(padLen===0) padLen=rateBytes;
  for(let i=0;i<padLen;i++) data.push(0);
  data[bytes.length]|=0x01;
  data[data.length-1]|=0x80;
  for(let off=0; off<data.length; off+=rateBytes){
    const block=data.slice(off,off+rateBytes);
    for(let j=0;j<block.length;j+=8){
      let word=0n;
      for(let k=7;k>=0;k--) word=(word<<8n)|BigInt(block[j+k]||0);
      const idx=j/8, x=idx%5, y=Math.floor(idx/5);
      state[x][y]^=word;
    }
    state=keccakF(state);
  }
  const out=[];
  while(out.length<32){
    for(let y=0;y<5 && out.length<32;y++) for(let x=0;x<5 && out.length<32;x++){
      let w=state[x][y];
      for(let k=0;k<8 && out.length<32;k++){ out.push(Number(w&0xFFn)); w>>=8n; }
    }
    if(out.length<32) state=keccakF(state);
  }
  return new Uint8Array(out);
}
function keccak256Hex(str){
  const enc=new TextEncoder().encode(str);
  const h=keccak256Bytes(enc);
  return "0x"+Array.from(h).map(b=>b.toString(16).padStart(2,"0")).join("");
}

/* ---------------- Small helpers ---------------- */
function explorerTxLink(hash){ return `<a class="explorer-link" href="${EXPLORER_BASE}/tx/${hash}" target="_blank">${hash.slice(0,10)}…${hash.slice(-6)}</a>`; }
function explorerAddrLink(addr){ return `<a class="explorer-link" href="${EXPLORER_BASE}/address/${addr}" target="_blank">${addr.slice(0,6)}…${addr.slice(-4)}</a>`; }
async function copyToClipboard(text){
  try{ await navigator.clipboard.writeText(text); return true; }catch(e){ return false; }
}

/* ---------------- Logging ---------------- */
function log(msg, cls){
  const el=document.getElementById('logBody');
  const time=new Date().toLocaleTimeString();
  const line=document.createElement('div');
  line.className='log-line';
  line.innerHTML=`<span class="ts">[${time}]</span> ${msg}`;
  el.appendChild(line); el.scrollTop=el.scrollHeight;
}

/* ---------------- RPC helpers ---------------- */
async function rpcCall(method, params){
  const res = await fetch(RPC_URL, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({jsonrpc:"2.0", id:1, method, params})
  });
  const json = await res.json();
  if(json.error) throw new Error(json.error.message||"RPC error");
  return json.result;
}
async function ethCall(to, dataHex){
  return rpcCall("eth_call", [{to, data:"0x"+dataHex}, "latest"]);
}

/* ---------------- ABI-ish encode/decode helpers ---------------- */
function padAddress(addr){ return addr.toLowerCase().replace("0x","").padStart(64,"0"); }
function padBool(b){ return (b?"1":"0").padStart(64,"0"); }
function stripHexPrefix(h){ return h.startsWith("0x")? h.slice(2): h; }

function decodeGetAllPrices(hex){
  const data=stripHexPrefix(hex);
  const word=(i)=>data.slice(i*64,i*64+64);
  const toBig=(w)=>BigInt("0x"+(w||"0"));
  const offsetValues=Number(toBig(word(0)))*2;
  const offsetDecimals=Number(toBig(word(1)))*2;
  const timestamp=toBig(word(2));
  const lenValues=Number(toBig(data.slice(offsetValues,offsetValues+64)));
  const values=[];
  for(let i=0;i<lenValues;i++){ const s=offsetValues+64+i*64; values.push(toBig(data.slice(s,s+64))); }
  const lenDecimals=Number(toBig(data.slice(offsetDecimals,offsetDecimals+64)));
  const decimals=[];
  for(let i=0;i<lenDecimals;i++){ const s=offsetDecimals+64+i*64; let v=toBig(data.slice(s,s+64)); if(v>(2n**255n)) v-=(2n**256n); decimals.push(Number(v)); }
  return {values, decimals, timestamp};
}
function decodeHasPosition(hex){
  const data=stripHexPrefix(hex);
  const exists = BigInt("0x"+data.slice(0,64)) === 1n;
  const ts = BigInt("0x"+data.slice(64,128));
  return {exists, ts};
}
function decodeBool(hex){
  const data=stripHexPrefix(hex);
  return BigInt("0x"+data.slice(0,64)) === 1n;
}

function fmtPrice(v,decimals){
  const n=Number(v)/Math.pow(10,decimals);
  if(n>1000) return n.toLocaleString(undefined,{maximumFractionDigits:2});
  if(n>1) return n.toFixed(2);
  return n.toFixed(4);
}

/* ---------------- Prices ---------------- */
async function refreshPrices(){
  try{
    const result = await ethCall(FTSO_CONSUMER, SEL_GET_ALL_PRICES);
    const decoded = decodeGetAllPrices(result);
    latestPrices = decoded;
    const cards = document.querySelectorAll('#tickerGrid .ticker-card');
    FEEDS.forEach((feed,i)=>{
      cards[i].querySelector('.price').textContent = "$"+fmtPrice(decoded.values[i], decoded.decimals[i]);
    });
    recomputeLocalTotal();
  }catch(err){
    log(`⚠ Price fetch failed: ${err.message}`);
  }
}

function parseHoldingsInput(){
  const raw = document.getElementById('holdingsInput').value;
  const parts = raw.split(",").map(s=>s.trim()).filter(Boolean);
  const out = [];
  for(const p of parts){
    const [sym, amt] = p.split(":").map(s=>s.trim());
    if(sym && amt && FEED_ASSET_MAP[sym] !== undefined) out.push({symbol:sym, amount:parseFloat(amt), feedIndex:FEED_ASSET_MAP[sym]});
  }
  return out;
}

function recomputeLocalTotal(){
  const holdings = parseHoldingsInput();
  let total=0;
  if(latestPrices){
    holdings.forEach(h=>{
      const p = Number(latestPrices.values[h.feedIndex])/Math.pow(10, latestPrices.decimals[h.feedIndex]);
      total += p*h.amount;
    });
  }
  document.getElementById('totalAmount').textContent = "$"+total.toLocaleString(undefined,{maximumFractionDigits:2});
}
document.getElementById('holdingsInput').addEventListener('input', recomputeLocalTotal);

/* ---------------- Wallet connect (MetaMask / injected) ---------------- */
async function connectMetaMask(){
  if(!window.ethereum){
    log('⚠ No injected wallet found. Open this page in a browser/app with MetaMask, or use "Scan QR" instead.');
    alert("No injected wallet detected. Open this page in MetaMask's browser, or use the 'Scan QR' button to connect any wallet app.");
    return;
  }
  try{
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    account = accounts[0];
    activeProvider = window.ethereum;
    currentChainId = await window.ethereum.request({method:'eth_chainId'});
    updateWalletUI();
    log(`Wallet connected (injected): ${account}`);

    if(currentChainId.toLowerCase() !== COSTON2_CHAIN_ID_HEX){
      document.getElementById('wrongNetworkBanner').style.display='block';
      document.getElementById('chainBadge').classList.add('wrong');
      try{
        await window.ethereum.request({method:'wallet_switchEthereumChain', params:[{chainId:COSTON2_CHAIN_ID_HEX}]});
      }catch(switchErr){
        if(switchErr.code === 4902){
          await window.ethereum.request({
            method:'wallet_addEthereumChain',
            params:[{
              chainId: COSTON2_CHAIN_ID_HEX,
              chainName: 'Flare Testnet Coston2',
              rpcUrls: [RPC_URL],
              nativeCurrency: {name:'Coston2 Flare', symbol:'C2FLR', decimals:18},
              blockExplorerUrls: ['https://coston2-explorer.flare.network']
            }]
          });
        } else {
          log(`⚠ Could not switch network: ${switchErr.message}`);
        }
      }
      currentChainId = await window.ethereum.request({method:'eth_chainId'});
      if(currentChainId.toLowerCase() === COSTON2_CHAIN_ID_HEX){
        document.getElementById('wrongNetworkBanner').style.display='none';
        document.getElementById('chainBadge').classList.remove('wrong');
        log('Switched to Coston2 (chain 114).');
      }
    }
    onWalletConnected();
  }catch(err){
    log(`⚠ Wallet connection failed: ${err.message}`);
  }
}

function onWalletConnected(){
  refreshPosition();
  loadOnChainHistory();
  refreshNetworkHealth();
}

function updateWalletUI(){
  const btn = document.getElementById('walletBtn');
  if(account){
    btn.textContent = account.slice(0,6)+'…'+account.slice(-4);
    btn.classList.add('connected');
  }else{
    btn.textContent = 'Connect Wallet';
    btn.classList.remove('connected');
  }
}
document.getElementById('walletBtn').addEventListener('click', connectMetaMask);

/* ---------------- Scan QR (WalletConnect via Reown AppKit) ---------------- */
document.getElementById('wcBtn').addEventListener('click', async () => {
  if (!appKitModal) {
    alert('WalletConnect is not configured yet — a Reown Project ID needs to be set in src/main.js (REOWN_PROJECT_ID). See the "Get your own free Project ID" comment at the top of that file.');
    return;
  }
  try {
    appKitModal.open();
    log('Opened WalletConnect QR modal — scan with any compatible wallet app.');
  } catch (err) {
    log(`⚠ Could not open WalletConnect modal: ${err.message}`);
  }
});

if (appKitModal) {
  // Fires whenever the eip155 (EVM) provider changes - i.e. a WalletConnect session connects or disconnects.
  appKitModal.subscribeProviders((state) => {
    const wcProvider = state['eip155'];
    if (wcProvider) {
      activeProvider = wcProvider;
      log('Wallet connected via WalletConnect (Scan QR).');
    }
  });
  // Fires whenever the connected account changes for the current provider.
  appKitModal.subscribeAccount((state) => {
    if (state && state.address && activeProvider && activeProvider !== window.ethereum) {
      account = state.address;
      updateWalletUI();
      onWalletConnected();
    }
  });
}

if(window.ethereum){
  window.ethereum.on && window.ethereum.on('accountsChanged', (accs)=>{
    if(activeProvider !== window.ethereum) return; // ignore if a WalletConnect session is active instead
    account = accs[0]||null; updateWalletUI(); if(account) refreshPosition();
  });
  window.ethereum.on && window.ethereum.on('chainChanged', (cid)=>{
    if(activeProvider !== window.ethereum) return;
    currentChainId = cid; location.reload();
  });
}

/* ---------------- Send transaction helper (works with either MetaMask or WalletConnect) ---------------- */
async function sendTx(to, dataHex){
  if(!account || !activeProvider){ throw new Error("Connect your wallet first."); }
  const txHash = await activeProvider.request({
    method:'eth_sendTransaction',
    params:[{ from: account, to, data: "0x"+dataHex }]
  });
  return txHash;
}

/* ---------------- Commit Position ---------------- */
document.getElementById('commitBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('commitStatus');
  try{
    if(!account) throw new Error("Connect your wallet first.");
    const raw = document.getElementById('holdingsInput').value;
    const hash = keccak256Hex(raw); // local commitment derived from your holdings string
    log(`Computed local commitment hash: ${hash}`);
    statusEl.textContent = `Sending commitPosition(${hash.slice(0,10)}…) — confirm in your wallet…`;
    statusEl.className = 'status-line';
    const data = SEL_COMMIT_POSITION + hash.replace("0x","");
    const txHash = await sendTx(PORTFOLIO_VAULT, data);
    log(`Transaction sent: ${explorerTxLink(txHash)}`);
    statusEl.innerHTML = `Tx sent: ${explorerTxLink(txHash)} — waiting a moment then refreshing…`;
    statusEl.className = 'status-line ok';
    setTimeout(()=>{ refreshPosition(); loadOnChainHistory(); }, 4000);
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
    log(`⚠ commitPosition failed: ${err.message}`);
  }
});

/* ---------------- Refresh position (hasPosition read) ---------------- */
async function refreshPosition(){
  if(!account) return;
  try{
    const data = SEL_HAS_POSITION + padAddress(account);
    const result = await ethCall(PORTFOLIO_VAULT, data);
    const {exists, ts} = decodeHasPosition(result);
    document.getElementById('posExists').textContent = exists ? 'true' : 'false';
    document.getElementById('posTimestamp').textContent = ts.toString() === '0' ? '—' : new Date(Number(ts)*1000).toLocaleString();
    document.getElementById('myCommitHash').textContent = exists ? 'committed ✓' : 'no position yet';
    log(`Read hasPosition(${account.slice(0,6)}…): exists=${exists}`);
  }catch(err){
    log(`⚠ refreshPosition failed: ${err.message}`);
  }
}
document.getElementById('refreshPositionBtn').addEventListener('click', refreshPosition);

/* ---------------- Verify Commitment ---------------- */
document.getElementById('verifyBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('verifyStatus');
  try{
    const addr = document.getElementById('verifyAddrInput').value.trim() || account;
    if(!addr) throw new Error("Connect a wallet or enter an address.");
    const raw = document.getElementById('holdingsInput').value;
    const hash = keccak256Hex(raw);
    const data = SEL_VERIFY_COMMITMENT + padAddress(addr) + hash.replace("0x","");
    const result = await ethCall(PORTFOLIO_VAULT, data);
    const matches = decodeBool(result);
    statusEl.textContent = matches
      ? `✓ Matches on-chain commitment for ${addr.slice(0,6)}…${addr.slice(-4)}`
      : `✗ Does not match on-chain commitment for ${addr.slice(0,6)}…${addr.slice(-4)} (or no position committed yet)`;
    statusEl.className = 'status-line ' + (matches?'ok':'err');
    log(`verifyCommitment(${addr.slice(0,6)}…, ${hash.slice(0,10)}…) → ${matches}`);
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
  }
});

/* ---------------- Viewer approval ---------------- */
async function setViewerApproval(approved){
  const statusEl = document.getElementById('viewerStatus');
  try{
    if(!account) throw new Error("Connect your wallet first.");
    const viewer = document.getElementById('viewerAddrInput').value.trim();
    if(!viewer || !viewer.startsWith('0x') || viewer.length !== 42) throw new Error("Enter a valid 0x… viewer address.");
    const data = SEL_SET_VIEWER_APPROVAL + padAddress(viewer) + padBool(approved);
    statusEl.textContent = `Sending setViewerApproval(${approved})… confirm in your wallet.`;
    statusEl.className = 'status-line';
    const txHash = await sendTx(PORTFOLIO_VAULT, data);
    statusEl.innerHTML = `Tx sent: ${explorerTxLink(txHash)}`;
    statusEl.className = 'status-line ok';
    log(`setViewerApproval(${viewer.slice(0,6)}…, ${approved}) → ${explorerTxLink(txHash)}`);
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
  }
}
document.getElementById('approveBtn').addEventListener('click', ()=>setViewerApproval(true));
document.getElementById('revokeBtn').addEventListener('click', ()=>setViewerApproval(false));

/* ---------------- Copy hash ---------------- */
document.getElementById('copyHashBtn').addEventListener('click', async ()=>{
  const raw = document.getElementById('holdingsInput').value;
  const hash = keccak256Hex(raw);
  const ok = await copyToClipboard(hash);
  const btn = document.getElementById('copyHashBtn');
  const original = btn.textContent;
  btn.textContent = ok ? '✓ Copied' : '⚠ Failed';
  setTimeout(()=>{ btn.textContent = original; }, 1500);
  log(`Commitment hash copied to clipboard: ${hash}`);
});

/* ---------------- Real on-chain history via eth_getLogs ---------------- */
async function loadOnChainHistory(){
  const body = document.getElementById('historyBody');
  if(!account){
    body.innerHTML = '<div class="log-line" style="color:var(--redacted)">Connect your wallet first.</div>';
    return;
  }
  body.innerHTML = '<div class="log-line" style="color:var(--redacted)">Fetching real events from chain…</div>';
  const userTopic = "0x"+padAddress(account);

  async function fetchLogs(topic0, extraTopics, fromBlock){
    return rpcCall("eth_getLogs", [{
      address: PORTFOLIO_VAULT,
      fromBlock: fromBlock || "0x0",
      toBlock: "latest",
      topics: [topic0, ...extraTopics]
    }]);
  }

  try{
    let committedLogs = [];
    let approvalLogs = [];
    try{
      committedLogs = await fetchLogs(TOPIC_POSITION_COMMITTED, [userTopic]);
    }catch(e){
      // Some RPCs cap block range on "0x0" — retry over a smaller recent window.
      committedLogs = await fetchLogs(TOPIC_POSITION_COMMITTED, [userTopic], "0x1E00000");
    }
    try{
      approvalLogs = await fetchLogs(TOPIC_VIEWER_APPROVAL_CHANGED, [userTopic]);
    }catch(e){
      approvalLogs = await fetchLogs(TOPIC_VIEWER_APPROVAL_CHANGED, [userTopic], "0x1E00000");
    }

    const events = [];
    committedLogs.forEach(l=>{
      const data = stripHexPrefix(l.data);
      const commitment = "0x"+data.slice(0,64);
      const ts = BigInt("0x"+data.slice(64,128));
      events.push({type:'PositionCommitted', block:parseInt(l.blockNumber,16), tx:l.transactionHash, detail:`commitment ${commitment.slice(0,10)}… at ${new Date(Number(ts)*1000).toLocaleString()}`});
    });
    approvalLogs.forEach(l=>{
      const viewer = "0x"+l.topics[2].slice(-40);
      const approved = decodeBool(l.data);
      events.push({type:'ViewerApprovalChanged', block:parseInt(l.blockNumber,16), tx:l.transactionHash, detail:`viewer ${viewer.slice(0,6)}…${viewer.slice(-4)} → ${approved?'approved':'revoked'}`});
    });

    events.sort((a,b)=>b.block-a.block);

    if(events.length===0){
      body.innerHTML = '<div class="log-line" style="color:var(--redacted)">No on-chain events found for this address yet. Commit a position above to create one.</div>';
      return;
    }

    body.innerHTML = events.map(e=>
      `<div class="log-line"><span class="ts">[block ${e.block}]</span> <b>${e.type}</b> — ${e.detail} — ${explorerTxLink(e.tx)}</div>`
    ).join('');
    log(`Loaded ${events.length} real on-chain event(s) for ${account.slice(0,6)}…`);
  }catch(err){
    body.innerHTML = `<div class="log-line" style="color:var(--ember)">⚠ Could not load history: ${err.message}</div>`;
  }
}
document.getElementById('loadHistoryBtn').addEventListener('click', loadOnChainHistory);

/* ---------------- FAssets: resolve + reserve collateral ---------------- */
function decodeAddress(hex){
  const data = stripHexPrefix(hex);
  return "0x"+data.slice(-40);
}
function decodeUint(hex){
  const data = stripHexPrefix(hex);
  return BigInt("0x"+data.slice(0,64));
}
function decodeAddressArrayWithTotal(hex){
  // returns (address[] _agents, uint256 _totalLength)
  const data = stripHexPrefix(hex);
  const word = (i)=>data.slice(i*64,i*64+64);
  const toBig = (w)=>BigInt("0x"+(w||"0"));
  const offsetAgents = Number(toBig(word(0)))*2;
  const totalLength = toBig(word(1));
  const lenAgents = Number(toBig(data.slice(offsetAgents,offsetAgents+64)));
  const agents = [];
  for(let i=0;i<lenAgents;i++){
    const s = offsetAgents+64+i*64;
    agents.push("0x"+data.slice(s+24, s+64));
  }
  return {agents, totalLength};
}

document.getElementById('resolveBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('resolveStatus');
  try{
    resolverAddr = document.getElementById('resolverAddrInput').value.trim();
    if(!resolverAddr || !resolverAddr.startsWith('0x') || resolverAddr.length !== 42){
      throw new Error("Enter a valid deployed FAssetsResolver.sol address first.");
    }
    statusEl.textContent = "Resolving live FXRP AssetManager…";
    statusEl.className = 'status-line';

    const amResult = await ethCall(resolverAddr, SEL_GET_ASSET_MANAGER_ADDRESS);
    resolvedAssetManager = decodeAddress(amResult);
    document.getElementById('assetManagerAddr').innerHTML = explorerAddrLink(resolvedAssetManager);
    document.getElementById('assetManagerAddr').classList.add('revealed');
    log(`Resolved live FXRP AssetManager: ${explorerAddrLink(resolvedAssetManager)}`);

    const countResult = await ethCall(resolverAddr, SEL_GET_AVAILABLE_AGENT_COUNT);
    const count = decodeUint(countResult);
    document.getElementById('agentCount').textContent = count.toString();
    document.getElementById('agentCount').classList.add('revealed');

    const feeResult = await ethCall(resolverAddr, SEL_GET_COLLATERAL_RESERVATION_FEE + (1n).toString(16).padStart(64,"0"));
    lastCRFee = decodeUint(feeResult);
    document.getElementById('crFee').textContent = (Number(lastCRFee)/1e18).toFixed(6)+" C2FLR";
    document.getElementById('crFee').classList.add('revealed');

    if(Number(count) > 0){
      const listData = SEL_GET_AVAILABLE_AGENTS_LIST + (0n).toString(16).padStart(64,"0") + (1n).toString(16).padStart(64,"0");
      const listResult = await ethCall(resolvedAssetManager, listData);
      const {agents} = decodeAddressArrayWithTotal(listResult);
      if(agents.length>0){
        firstAgentVault = agents[0];
        document.getElementById('reserveBtn').disabled = false;
        log(`First available agent vault: ${explorerAddrLink(firstAgentVault)}`);
      }
    }
    statusEl.textContent = "✓ Resolved successfully — live data above.";
    statusEl.className = 'status-line ok';
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
    log(`⚠ FAssets resolve failed: ${err.message}`);
  }
});

document.getElementById('reserveBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('reserveStatus');
  try{
    if(!account) throw new Error("Connect your wallet first.");
    if(!resolvedAssetManager || !firstAgentVault || lastCRFee===null) throw new Error("Resolve the AssetManager first.");
    statusEl.textContent = "Sending reserveCollateral(1 lot)… confirm in your wallet.";
    statusEl.className = 'status-line';

    const data = SEL_RESERVE_COLLATERAL
      + padAddress(firstAgentVault)
      + (1n).toString(16).padStart(64,"0")          // 1 lot
      + (10000n).toString(16).padStart(64,"0")      // maxMintingFeeBIPS = 10000 (100% cap, demo simplicity)
      + ZERO_ADDRESS.padStart(64,"0");               // no executor

    const txHash = await activeProvider.request({
      method:'eth_sendTransaction',
      params:[{ from: account, to: resolvedAssetManager, data: "0x"+data, value: "0x"+lastCRFee.toString(16) }]
    });
    statusEl.innerHTML = `✓ Real reserveCollateral tx sent: ${explorerTxLink(txHash)} — check the explorer for your CollateralReservationId.`;
    statusEl.className = 'status-line ok';
    log(`reserveCollateral(1 lot) on real FXRP AssetManager → ${explorerTxLink(txHash)}`);
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
    log(`⚠ reserveCollateral failed: ${err.message}`);
  }
});

/* ---------------- Network health (real, live) ---------------- */
async function refreshNetworkHealth(){
  try{
    const blockHex = await rpcCall("eth_blockNumber", []);
    document.getElementById('healthBlock').textContent = "#"+BigInt(blockHex).toString();
  }catch(e){}
  try{
    const gasHex = await rpcCall("eth_gasPrice", []);
    const gwei = Number(BigInt(gasHex))/1e9;
    document.getElementById('healthGas').textContent = gwei.toFixed(1)+" gwei";
  }catch(e){}
  if(account){
    try{
      const balHex = await rpcCall("eth_getBalance", [account, "latest"]);
      const bal = Number(BigInt(balHex))/1e18;
      document.getElementById('healthBalance').textContent = bal.toFixed(4)+" C2FLR";
    }catch(e){}
  }
}

/* ---------------- Vault snapshot export ---------------- */
document.getElementById('downloadSnapshotBtn').addEventListener('click', async ()=>{
  const raw = document.getElementById('holdingsInput').value;
  const hash = keccak256Hex(raw);
  const exists = document.getElementById('posExists').textContent;
  const lastValued = document.getElementById('posTimestamp').textContent;
  const snapshot = {
    app: "Flare Vault",
    network: "Flare Testnet Coston2 (chain 114)",
    wallet: account || null,
    portfolioVaultContract: PORTFOLIO_VAULT,
    ftsoConsumerContract: FTSO_CONSUMER,
    localCommitmentHash: hash,
    onChainPositionExists: exists,
    onChainLastValuedAt: lastValued,
    generatedAt: new Date().toISOString(),
    note: "This snapshot proves a commitment hash was computed and (if exists=true) recorded on-chain. Raw holdings are intentionally not included."
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `flare-vault-snapshot-${Date.now()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  log("Downloaded vault snapshot (.json) — holdings excluded by design.");
});

/* ---------------- Tab switching ---------------- */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.style.display='none');
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).style.display='block';
  });
});

/* ---------------- Sign-in gate wiring ---------------- */
function ivLog(msg){
  const el = document.getElementById('ivLogBody');
  if(!el) return;
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="ts">[${time}]</span> ${msg}`;
  el.appendChild(line); el.scrollTop = el.scrollHeight;
}

/* ---------------- Real AES-256-GCM encryption (Web Crypto, native browser API) ---------------- */
function toB64(bytes){ return btoa(String.fromCharCode(...bytes)); }
function fromB64(str){ return Uint8Array.from(atob(str), c=>c.charCodeAt(0)); }

async function deriveAesKey(passphrase, saltBytes){
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), {name:"PBKDF2"}, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2", salt: saltBytes, iterations: 100000, hash:"SHA-256"},
    keyMaterial, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]
  );
}
async function encryptMessage(message, passphrase){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, enc.encode(message));
  return { v:1, alg:"AES-256-GCM", kdf:"PBKDF2-SHA256-100000", salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(new Uint8Array(ciphertextBuf)) };
}
async function decryptMessage(blob, passphrase){
  const salt = fromB64(blob.salt);
  const iv = fromB64(blob.iv);
  const ciphertext = fromB64(blob.ciphertext);
  const key = await deriveAesKey(passphrase, salt);
  const plainBuf = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ciphertext);
  return new TextDecoder().decode(plainBuf);
}

/* ---------------- InheritanceVault: contract address setup ---------------- */
document.getElementById('ivSaveAddrBtn').addEventListener('click', ()=>{
  const addr = document.getElementById('ivAddrInput').value.trim();
  const statusEl = document.getElementById('ivAddrStatus');
  if(!addr || !addr.startsWith('0x') || addr.length !== 42){
    statusEl.textContent = "⚠ Enter a valid deployed InheritanceVault.sol address.";
    statusEl.className = 'status-line err';
    return;
  }
  ivContractAddr = addr;
  statusEl.textContent = "✓ Using this contract for all Inheritance Vault actions below.";
  statusEl.className = 'status-line ok';
  ivLog(`Contract set: ${explorerAddrLink(addr)}`);
  refreshIvStatus();
});

/* ---------------- Encrypt & download message file ---------------- */
document.getElementById('ivEncryptBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('ivCreateStatus');
  try{
    const message = document.getElementById('ivMessageInput').value;
    const passphrase = document.getElementById('ivPassphraseInput').value;
    if(!message) throw new Error("Write a message first.");
    if(!passphrase || passphrase.length < 6) throw new Error("Passphrase must be at least 6 characters.");
    const blob = await encryptMessage(message, passphrase);
    ivLastCiphertextBlob = blob;
    const blobJson = JSON.stringify(blob);
    ivLastHash = keccak256Hex(blobJson);

    const fileBlob = new Blob([blobJson], {type:"application/json"});
    const url = URL.createObjectURL(fileBlob);
    const a = document.createElement('a');
    a.href = url; a.download = `flare-vault-message-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    statusEl.textContent = `✓ Encrypted with real AES-256-GCM. File downloaded. Commitment hash ready: ${ivLastHash.slice(0,10)}… — now click "Create Vault On-Chain". Share the downloaded file + your passphrase with your beneficiary out-of-band.`;
    statusEl.className = 'status-line ok';
    ivLog(`Message encrypted (AES-256-GCM). Commitment hash: ${ivLastHash}`);
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
  }
});

/* ---------------- Create vault on-chain ---------------- */
document.getElementById('ivCreateBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('ivCreateStatus');
  try{
    if(!account) throw new Error("Connect your wallet first.");
    if(!ivContractAddr) throw new Error("Set your InheritanceVault contract address above first.");
    const beneficiary = document.getElementById('ivBeneficiaryInput').value.trim();
    if(!beneficiary || !beneficiary.startsWith('0x') || beneficiary.length !== 42) throw new Error("Enter a valid beneficiary address.");
    const intervalSeconds = BigInt(document.getElementById('ivIntervalSelect').value);
    const hash = ivLastHash || ("0x"+"0".repeat(64)); // allow creating without a message, using a zero hash

    const data = SEL_IV_CREATE_VAULT
      + padAddress(beneficiary)
      + intervalSeconds.toString(16).padStart(64,"0")
      + hash.replace("0x","");

    statusEl.textContent = "Sending createVault()… confirm in your wallet.";
    statusEl.className = 'status-line';
    const txHash = await sendTx(ivContractAddr, data);
    statusEl.innerHTML = `✓ Vault created: ${explorerTxLink(txHash)}`;
    statusEl.className = 'status-line ok';
    ivLog(`createVault(beneficiary=${beneficiary.slice(0,6)}…, interval=${intervalSeconds}s) → ${explorerTxLink(txHash)}`);
    setTimeout(refreshIvStatus, 4000);
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
    ivLog(`⚠ createVault failed: ${err.message}`);
  }
});

/* ---------------- Decode getVault() ---------------- */
function decodeGetVaultResult(hex){
  const data = stripHexPrefix(hex);
  const word = (i)=>data.slice(i*64,i*64+64);
  const beneficiary = "0x"+word(0).slice(-40);
  const instructionsHash = "0x"+word(1);
  const lastCheckIn = BigInt("0x"+word(2));
  const checkInInterval = BigInt("0x"+word(3));
  const claimed = BigInt("0x"+word(4)) === 1n;
  const exists = BigInt("0x"+word(5)) === 1n;
  return {beneficiary, instructionsHash, lastCheckIn, checkInInterval, claimed, exists};
}

function formatDuration(seconds){
  if(seconds<=0) return "unlocked now";
  const d = Math.floor(seconds/86400); seconds%=86400;
  const h = Math.floor(seconds/3600); seconds%=3600;
  const m = Math.floor(seconds/60);
  const parts=[];
  if(d>0) parts.push(d+"d"); if(h>0) parts.push(h+"h"); if(parts.length<2 && m>0) parts.push(m+"m");
  return parts.length? parts.join(" "): "under a minute";
}

async function refreshIvStatus(){
  if(!account || !ivContractAddr) return;
  try{
    const data = SEL_IV_GET_VAULT + padAddress(account);
    const result = await ethCall(ivContractAddr, data);
    const v = decodeGetVaultResult(result);
    document.getElementById('ivExists').textContent = v.exists ? 'true' : 'false';
    document.getElementById('ivBeneficiary').innerHTML = v.exists ? explorerAddrLink(v.beneficiary) : '—';
    document.getElementById('ivLastCheckIn').textContent = v.exists ? new Date(Number(v.lastCheckIn)*1000).toLocaleString() : '—';
    document.getElementById('ivClaimed').textContent = v.exists ? (v.claimed?'true':'false') : '—';

    if(v.exists && !v.claimed){
      ivCountdownTarget = Number(v.lastCheckIn) + Number(v.checkInInterval);
      ivIntervalTotal = Number(v.checkInInterval);
      tickIvCountdown();
    } else {
      ivCountdownTarget = null;
      ivIntervalTotal = null;
      document.getElementById('ivTimeRemaining').textContent = '—';
      document.getElementById('ivTimeRemainingHero').textContent = v.claimed ? '✓ claimed' : '—';
      document.getElementById('ivTimeRemainingHero').className = 'countdown-value';
    }
    ivLog(`Refreshed vault status for ${account.slice(0,6)}… — exists=${v.exists}`);
  }catch(err){
    ivLog(`⚠ refreshIvStatus failed: ${err.message}`);
  }
}
function tickIvCountdown(){
  if(ivCountdownTarget===null) return;
  const now = Math.floor(Date.now()/1000);
  const remaining = ivCountdownTarget - now;
  const text = remaining>0 ? formatDuration(remaining) : "⚠ unlocked — claimable now";
  document.getElementById('ivTimeRemaining').textContent = text;

  const heroEl = document.getElementById('ivTimeRemainingHero');
  heroEl.textContent = text;
  const fractionLeft = ivIntervalTotal ? Math.max(0, remaining) / ivIntervalTotal : 1;
  heroEl.className = 'countdown-value';
  if(remaining<=0) heroEl.classList.add('danger');
  else if(fractionLeft < 0.15) heroEl.classList.add('danger');
  else if(fractionLeft < 0.4) heroEl.classList.add('warn');
}
setInterval(tickIvCountdown, 1000);
document.getElementById('ivRefreshBtn').addEventListener('click', refreshIvStatus);
document.getElementById('ivCheckInBtn').addEventListener('click', async ()=>{
  try{
    if(!account) throw new Error("Connect your wallet first.");
    if(!ivContractAddr) throw new Error("Set your InheritanceVault contract address first.");
    const txHash = await sendTx(ivContractAddr, SEL_IV_CHECKIN);
    ivLog(`checkIn() → ${explorerTxLink(txHash)}`);
    setTimeout(refreshIvStatus, 4000);
  }catch(err){
    ivLog(`⚠ checkIn failed: ${err.message}`);
  }
});

/* ---------------- Claim as beneficiary ---------------- */
let ivOwnerBeingChecked = null;
document.getElementById('ivCheckOwnerBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('ivOwnerStatus');
  try{
    if(!ivContractAddr) throw new Error("Set the InheritanceVault contract address first.");
    const owner = document.getElementById('ivOwnerToCheckInput').value.trim();
    if(!owner || !owner.startsWith('0x') || owner.length !== 42) throw new Error("Enter a valid owner address.");
    const result = await ethCall(ivContractAddr, SEL_IV_GET_VAULT + padAddress(owner));
    const v = decodeGetVaultResult(result);
    const remResult = await ethCall(ivContractAddr, SEL_IV_TIME_REMAINING + padAddress(owner));
    const remaining = decodeUint(remResult);

    if(!v.exists){
      statusEl.textContent = "No vault found for this owner.";
      statusEl.className = 'status-line err';
      document.getElementById('ivClaimBtn').disabled = true;
    } else if(v.claimed){
      statusEl.textContent = "This vault has already been claimed.";
      statusEl.className = 'status-line err';
      document.getElementById('ivClaimBtn').disabled = true;
    } else if(Number(remaining) > 0){
      statusEl.textContent = `Owner still active — ${formatDuration(Number(remaining))} remaining before this vault can be claimed.`;
      statusEl.className = 'status-line';
      document.getElementById('ivClaimBtn').disabled = true;
    } else {
      statusEl.textContent = `✓ This vault is expired and claimable. Named beneficiary: ${v.beneficiary}`;
      statusEl.className = 'status-line ok';
      document.getElementById('ivClaimBtn').disabled = !(account && account.toLowerCase()===v.beneficiary.toLowerCase());
      if(account && account.toLowerCase()!==v.beneficiary.toLowerCase()){
        statusEl.textContent += " — but your connected wallet is not the named beneficiary.";
      }
    }
    ivOwnerBeingChecked = owner;
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
  }
});
document.getElementById('ivClaimBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('ivClaimStatus');
  try{
    if(!account) throw new Error("Connect your wallet first.");
    if(!ivOwnerBeingChecked) throw new Error("Check an owner's status first.");
    const data = SEL_IV_CLAIM + padAddress(ivOwnerBeingChecked);
    const txHash = await sendTx(ivContractAddr, data);
    statusEl.innerHTML = `✓ Claim submitted: ${explorerTxLink(txHash)}`;
    statusEl.className = 'status-line ok';
    ivLog(`claim(${ivOwnerBeingChecked.slice(0,6)}…) → ${explorerTxLink(txHash)}`);
  }catch(err){
    statusEl.textContent = `⚠ ${err.message}`;
    statusEl.className = 'status-line err';
  }
});

/* ---------------- Theme toggle ---------------- */
document.getElementById('themeToggle').addEventListener('click', ()=>{
  const body=document.body;
  const isDark = body.getAttribute('data-theme')==='dark';
  body.setAttribute('data-theme', isDark?'light':'dark');
  document.getElementById('themeToggle').textContent = isDark? '☀️':'🌙';
});

/* ---------------- Init ---------------- */
log('Flare Vault loaded — fetching live FTSOv2 prices from Coston2…');
refreshPrices();
refreshNetworkHealth();
setInterval(refreshPrices, 6000);
setInterval(refreshNetworkHealth, 8000);
