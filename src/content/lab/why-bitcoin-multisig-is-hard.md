---
title: Why Bitcoin Multisig Is Hard
blurb: A 2-of-3 escrow sounds simple until you actually have to build one. Notes on PSBTs, key derivation, and the failure modes nobody warns you about.
date: 2026-06-18
tags: [BITCOIN, ENGINEERING]
cover: ../../assets/lab/multisig.webp
coverDepth: ../../assets/lab/multisig-depth.webp
accent: "#f7931a"
featured: true
readingTime: 8
---

Everyone's first multisig looks the same. You read BIP67, you wire up three keys, you build a `2-of-3` output, and it works on the first try. You feel like a wizard.

Then you try to ship it as an _escrow_ — real money, an adversarial counterparty, a liquidation path that has to fire in the middle of the night without a human — and the whole thing turns to sand in your hands. The cryptography was never the hard part. The hard part is everything wrapped around it.

This is a field report from building a Bitcoin-backed lending escrow: a 2-of-3 multisig holding the collateral, with the lender, the borrower, and the platform each controlling one key. Here's what actually bit us.

## The output is the easy 10%

A `2-of-3` P2WSH output is a witness script and a hash. In `bitcoinjs-lib` it's almost anticlimactic:

```ts
const p2ms = bitcoin.payments.p2ms({
  m: 2,
  pubkeys: [lenderPub, borrowerPub, platformPub], // BIP67-sorted
  network,
});
const p2wsh = bitcoin.payments.p2wsh({ redeem: p2ms, network });

// p2wsh.address is where the collateral goes.
// p2wsh.redeem.output is the witnessScript every signer will need later.
```

That's it. That's the part every tutorial covers. The moment you have coins sitting at that address, you inherit a set of problems that no `payments.p2ms` call will solve for you.

> The escrow isn't the script. The escrow is the choreography of getting three parties to agree on _one_ transaction they've never seen at the same time.

## Problem one: nobody is in the same room

To spend from the multisig you need two signatures over the _same_ transaction — same inputs, same outputs, same sighash. But the lender, the borrower, and the platform are three services that never hold the transaction simultaneously. Somebody constructs it, somebody else adds a signature, a third party finalizes.

This is the entire reason **PSBTs** (BIP174) exist, and it's why "just sign the transaction" is a lie. What you're really passing around is a partially-signed container that accumulates signatures as it travels:

```ts
const psbt = new bitcoin.Psbt({ network });

psbt.addInput({
  hash: utxo.txid,
  index: utxo.vout,
  witnessUtxo: { script: p2wsh.output!, value: utxo.value },
  witnessScript: p2wsh.redeem!.output!, // REQUIRED for a P2WSH input
});
psbt.addOutput({ address: payoutAddress, value: utxo.value - fee });

// Each signer, independently, on their own machine:
psbt.signInput(0, signerKeyPair);

// A coordinator collects two signed copies and merges:
combined.combine(signerAPsbt, signerBPsbt);
combined.finalizeAllInputs();
const tx = combined.extractTransaction();
```

Miss the `witnessScript` on the input and signing fails with an error that tells you nothing. Forget that the coordinator must `combine()` before `finalize()` and you'll finalize a PSBT with one signature and wonder why the network rejects it. The library is happy to let you build something that will never confirm.

## Problem two: which key, exactly?

Each party doesn't have _a_ key. They have an HD wallet, and the multisig uses one derived child of it. So now every signature depends on all three parties agreeing on the exact derivation path — `m/48'/0'/0'/2'/0/0` for the first escrow, a different leaf for the next.

Get the derivation off by one hardened index and the public key you registered in the multisig no longer matches the private key you're signing with. The signature is valid; it just doesn't satisfy the script. You will stare at a correct-looking signature that the network rejects, and there is no error message for "you signed with the wrong grandchild."

We solved this by making the path a first-class, stored field of the escrow record — never re-derived, never inferred. If you can't reproduce the exact path from persisted data, you can't recover the funds, so the path is as much "the money" as the keys are.

## Problem three: the transaction that has to sign itself

The liquidation path was the one that kept me up. When the loan's LTV crosses a threshold, the platform needs to move collateral _without_ the borrower cooperating — that's the whole point of the platform holding key #3. Lender + platform = 2-of-3, borrower absent.

But a transaction that fires autonomously is a transaction you signed in advance, and a pre-signed Bitcoin transaction is frozen: it commits to specific inputs, a specific fee, and a specific output. If the fee market moves, your pre-signed liquidation is either stuck (fee too low) or overpaying wildly. There's no `RBF` on something you signed a week ago and handed to a bot.

The answer isn't clever — it's operational. You keep the pre-signed safety-net transaction as a _floor_, and you keep a hot path that re-derives and re-signs against live fee estimates when the platform is online. The pre-signed version is the "we lost the server, funds are still recoverable" guarantee, not the day-to-day mechanism. Designing that split — what's automated, what's pre-committed, what's the fallback of the fallback — is where the real work lives.

## What I'd tell past me

- **The address is a checkpoint, not the finish line.** Getting coins _into_ the multisig proves nothing about your ability to get them _out_.
- **Persist the derivation path like it's the private key.** Because operationally, it is.
- **Test the uncooperative-party flow first.** The happy path where everyone signs is the one that always works. The escrow only earns its name when someone _won't_ sign.
- **PSBT errors are almost never about cryptography.** They're about a missing `witnessScript`, a bad path, or finalizing before combining. Read the container, not the curve.

Multisig is hard the way a bridge is hard. Anyone can span a stream with a plank. The engineering is in what happens when the water rises and one of the people who was supposed to hold up their end simply walks away.
