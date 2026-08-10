---
title: "Zenoh io_uring Support"
weight: 3800
menu:
  docs:
    parent: manual
---

# Zenoh io_uring Support

Zenoh can use Linux `io_uring` to accelerate part of its transport receive path. Support was introduced in [PR #2332](https://github.com/eclipse-zenoh/zenoh/pull/2332/) and is enabled at build time with the `uring` Cargo feature.

The feature is an internal transport optimization. It does not change Zenoh's public API or require endpoint or runtime configuration changes.

> **Scope:** In PR #2332, `io_uring` is used for eligible **unicast receive (RX)** paths only. The transmit (TX) path and multicast receive path continue to use the existing implementation.

## Enabling io_uring

The `uring` feature is opt-in and is not part of Zenoh's default feature set.

When building the `zenoh` package from the workspace, enable it explicitly:

```bash
cargo build -p zenoh --features uring
```

Applications that depend on the `zenoh` crate can enable the same `uring` dependency feature in their Cargo feature configuration.

No additional Zenoh configuration is required. At runtime, Zenoh uses `io_uring` only when the backend initializes successfully and the selected unicast link exposes a suitable file descriptor. Otherwise, the receive path falls back to the standard Tokio-based implementation.

## Platform and Runtime Requirements

| Requirement | Details |
| --- | --- |
| Operating system | The `io_uring` backend is active on Linux only. The `zenoh-uring` implementation is conditionally compiled behind `target_os = "linux"`; non-Linux builds do not use the backend. |
| Kernel | Upstream Linux 6.1 or newer is the practical minimum for this backend because the implementation requests `IORING_SETUP_DEFER_TASKRUN`, in addition to multishot receive and `IORING_SETUP_SINGLE_ISSUER`. A vendor kernel with equivalent backports can also work. If reactor creation fails, Zenoh logs a warning and falls back to Tokio RX. |
| Locked memory | Receive buffers are allocated from an `mmap`-backed arena and committed pages are locked with `mlock`. The process therefore needs a sufficient `RLIMIT_MEMLOCK` (`memlock`) allowance. |
| Cargo feature | The `uring` feature must be enabled explicitly. |

The CI job for the feature removes the locked-memory limit before running the test suite:

```bash
sudo prlimit --memlock=unlimited --pid=$$
cargo nextest run -p zenoh -F uring
```

An unlimited `memlock` limit is useful for CI, but production deployments should size the limit according to their workload and system policy.

## Backend Selection and Fallback

When a `TransportManager` is created on Linux with the `uring` feature enabled, Zenoh attempts to create a shared `io_uring` reader. Failure to initialize the reader is non-fatal: Zenoh records a warning and continues with Tokio RX.

For each unicast receive task, Zenoh selects the backend independently:

1. If the shared `io_uring` reader is available and the link exposes a usable file descriptor, Zenoh starts the `io_uring` receive path.
2. Otherwise, Zenoh uses the existing Tokio receive path.

This makes the feature transparent to applications and allows unsupported links to coexist with links that use `io_uring`.

For UDP, only connected sockets expose an FD to this receive path. Unconnected UDP sockets can be shared by multiple peers and therefore remain on the non-`io_uring` path.

## How the Receive Path Works

The `uring` feature introduces the internal `zenoh-uring` crate. The crate is not a public Zenoh API and should not be depended on directly by applications.

The receive path is built around the following components:

- **Reader reactor** — owns the `io_uring` instance, processes completion queue entries, accepts start/stop commands, and runs from the Zenoh RX runtime's blocking executor.
- **Multishot receive** — each eligible FD is read using `RecvMulti`, allowing multiple receive completions from one submitted operation.
- **Provided buffer groups** — receive memory is supplied to `io_uring` with `ProvideBuffers`; buffers are recycled back into the arena after Zenoh releases them.
- **Buffer arena** — `BatchArena` reserves a contiguous virtual address range with `mmap` and locks committed portions with `mlock`. The arena can grow as additional receive buffers are required.
- **Stream reassembly** — stream-oriented links use an RX window to reconstruct Zenoh batches that span multiple receive completions.

A single reader can service multiple eligible receive tasks. Completion handling and the internal transport receive callbacks associated with that reader are serialized through the reactor loop. This is an implementation detail and is separate from the execution model of application-level subscriber callbacks.

## Buffer Handling and Zero-Copy Semantics

The implementation is designed to avoid unnecessary **additional userspace copies** after data has been received into an `io_uring`-provided buffer.

When a complete Zenoh batch fits in one receive buffer, the data can be exposed as a `ZSlice` referencing that buffer. When a batch is fragmented across multiple receive buffers, Zenoh can represent it as a `ZBuf` composed of multiple slices rather than copying the fragments into a new contiguous allocation.

This behavior should not be confused with Linux [**io_uring Zero Copy Rx (ZC Rx)**](https://docs.kernel.org/networking/iou-zcrx.html). PR #2332 uses multishot receive with provided buffers; it does not use the separate kernel ZC Rx facility that removes the kernel-to-userspace network receive copy.

## Performance Considerations

Performance improvements depend on transport type, payload size, publication rate, kernel version, CPU topology, and workload.

A review benchmark for PR #2332 used TCP loopback on a single Linux host. In that environment, enabling `uring` produced a statistically significant reduction of approximately 18–22% in round-trip latency for 1 KiB and 64 KiB payloads. Throughput was effectively neutral relative to the same PR build without the feature. The benchmark also showed that the advantage decreased near and beyond saturation.

These measurements should be treated as workload-specific benchmark results rather than a general performance guarantee. Applications with performance-sensitive deployments should benchmark both backends under representative traffic and hardware conditions.

Because PR #2332 accelerates RX only, it should not be described as an `io_uring` transmit or full-duplex transport implementation.

## Memory Considerations

The receive arena is sized from Zenoh's transport batch and link RX buffer settings and can reserve additional buffers as demand grows. Committed receive memory is locked with `mlock`, so higher concurrency and receive-buffer pressure can increase locked-memory usage.

If the arena cannot lock additional memory, further growth may fail. Check the process's locked-memory limit when diagnosing initialization failures or persistent receive-buffer pressure:

```bash
ulimit -l
```

Increase the limit only as required by the deployment and its resource policy.

## Troubleshooting

### `io_uring reactor init failed, falling back to tokio RX`

This warning means Zenoh could not initialize the `io_uring` reader. The failure is non-fatal: Zenoh continues using the Tokio receive path.

Check the Linux kernel capabilities required by the implementation and verify that the process has enough locked-memory allowance for the receive arena.

### The `uring` feature is enabled, but a link still uses Tokio

This can be expected. The `io_uring` receive path is selected only for eligible unicast links that expose a suitable FD. Links without one, unconnected UDP sockets, multicast traffic, and non-Linux platforms continue to use the existing receive implementation.

### `ENOBUFS`

`ENOBUFS` means the multishot receive operation temporarily ran out of provided buffers. The reader handles this condition by restarting the receive operation and attempts to keep the buffer group replenished.

Repeated buffer exhaustion can indicate sustained receive-buffer pressure or an inability to grow the locked-memory arena. Inspect resource limits and workload-specific buffer sizing if it becomes persistent.

### Receive-task `ECANCELED` or `EALREADY` errors

These errors are handled at the individual receive-task level. If they occur repeatedly outside normal task shutdown or cancellation, collect the surrounding Zenoh logs and report the issue with the affected transport and kernel details.

## Testing

CI adds Linux-specific coverage for the feature and runs Clippy with `uring` enabled. The runtime test job uses:

```bash
sudo prlimit --memlock=unlimited --pid=$$
cargo nextest run -p zenoh -F uring
```

For performance validation, use release builds and compare otherwise identical builds with and without the `uring` feature under a representative workload.