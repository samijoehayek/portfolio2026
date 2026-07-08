---
title: Rust for the Parts That Must Not Fail
blurb: You don't rewrite everything in Rust. You reach for it exactly where a bug isn't a bug — it's a lost key, a double-spend, or a settlement that silently went wrong.
date: 2026-04-02
tags: [RUST, ENGINEERING]
cover: ../../assets/lab/rust.webp
accent: "#d34516"
readingTime: 6
---

The Rust evangelism you see online does the language a disservice. "Rewrite it in Rust" is a meme, and like most memes it's mostly wrong. You don't rewrite your CRUD app in Rust. You don't need borrow-checker ceremony to render a form.

But there's a specific category of code where Rust stops being a lifestyle choice and becomes the correct engineering decision: the code where a bug isn't an inconvenience — it's an _irreversible_ event. A lost private key. A double-spend. A settlement that reported success while quietly doing the wrong thing. In blockchain systems, that category is bigger than usual, and it's exactly where I reach for Rust.

## The compiler as an adversary you _want_

Most languages treat you as a collaborator. Rust treats you as a suspect, and in security-critical code that's precisely the relationship you want. The compiler's job is to refuse to build code that _might_ be wrong, and it does that job with a bluntness that's uncomfortable until you realize the discomfort is load-bearing.

Consider signing key material. In a garbage-collected language, a key is a byte array that lives wherever it drifts — copied on assignment, captured by a closure, lingering in memory long after you're done, cloned into a log line by an intern's `println`. In Rust, ownership makes the key's lifetime a thing the compiler _tracks_:

```rust
fn sign(msg: &[u8], key: SigningKey) -> Signature {
    let sig = key.sign(msg);
    sig
    // `key` is MOVED into this function and dropped at the end of scope.
    // The caller cannot use it again — the compiler forbids it.
    // Combine with a `Zeroizing<_>` wrapper and the bytes are wiped on drop.
}
```

The key can't accidentally outlive its purpose, can't be silently copied into a place you forgot about, and — wrapped in `zeroize` — can't linger in RAM after use. None of that is a runtime check you hope fires. It's a compile-time property. The unsafe program doesn't get built.

> In most code a bug costs you a retry. In this code a bug costs you a key. Rust is the language that makes the second kind of bug fail to compile.

## Errors you can't pretend didn't happen

The other place Rust earns its keep is the boundary between "it worked" and "it didn't." In too many languages, failure is invisible until it isn't — an exception you forgot could be thrown, a null that propagates three layers before it detonates, a returned error code nobody checked.

Rust makes fallibility a value you're forced to hold:

```rust
fn settle(tx: &Transaction) -> Result<Receipt, SettlementError> {
    let inputs = validate_inputs(tx)?;   // ? = handle the error or bubble it, no third option
    let receipt = broadcast(inputs)?;
    Ok(receipt)
}
```

That `Result` is not a suggestion. You cannot get the `Receipt` out without acknowledging that `SettlementError` exists — the type system won't let you reach the success value while ignoring the failure one. For a settlement path, "you must explicitly decide what happens when this fails" is not bureaucracy. It's the whole job.

The same goes for `Option`. There is no null. The absence of a value is a case the compiler makes you handle, which means the class of bug where something is unexpectedly missing at 3am simply doesn't have a place to hide.

## Where I _don't_ reach for it

Honesty matters here, because overselling Rust is how you end up rewriting a dashboard for six weeks and shipping nothing. Rust is a poor fit when:

- **The cost of a bug is a retry.** A flaky UI animation, a mislabeled chart, a form that needs re-submitting — the borrow checker's tax buys you nothing there. Use the language that ships fastest.
- **The domain is still molten.** Rust rewards code whose shape you understand. When you're still discovering what you're building, its rigidity fights you. Prototype in something forgiving; harden the parts that survive.
- **The team can't carry it.** A language only makes code safer if the people maintaining it can read it. Rust in a codebase nobody else understands is a liability wearing a safety vest.

## The actual principle

The heuristic I've landed on isn't "Rust good." It's: **match the strictness of the tool to the irreversibility of the mistake.**

Reversible mistakes want fast, forgiving tools — you'll make them, you'll fix them, you'll move on. Irreversible mistakes want a tool that refuses to compile the mistake in the first place, even at the cost of making you prove things you'd rather hand-wave.

In a blockchain system, the surface area of irreversible mistakes is unusually large — keys, signatures, settlement, consensus-adjacent logic. That's not a reason to write everything in Rust. It's a reason to know exactly which files can never be wrong, and to spend the language's strictness there and nowhere else. Precision about _where_ you're paranoid is the whole skill.
