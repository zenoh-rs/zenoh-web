---
title: "Zenoh io_uring Support"
weight: 3800
menu:
  docs:
    parent: manual
---

# Zenoh io_uring Support

This document describes the **io_uring** feature introduced in Zenoh [PR #2332](https://github.com/eclipse-zenoh/zenoh/pull/2332/). When enabled through the `uring` feature flag, Zenoh can leverage the Linux `io_uring` asynchronous I/O interface for improved performance and reduced overhead in the transport layer.

The feature is implemented as an internal enhancement and does not change Zenoh’s public API.

## Key Features and Benefits

- **Reduced latency**: the `uring` backend can reduce message latency by roughly 25–50% and may improve message rate by a few percent.
- **Zero-copy path**: reader and writer implementations are optimized for zero-copy handling of split and fragmented payloads.
- **Efficient buffer management**: uses a page-backed arena with pinned memory (`mmap`/`mlock`) to provide both io_uring-provided buffers and registered `iovec` buffers.
- **Automatic read-mode selection**: the transport stack automatically chooses between io_uring and tokio based on availability and feature configuration.
- **Transparent integration**: the existing transport model remains intact; the non-uring path continues to work normally when the feature is disabled.

## Requirements and Limitations

| Requirement / Limitation | Details |
| --- | --- |
| Operating system | Linux only. The feature is guarded by `#[cfg(target_os = "linux")]` and will not compile on other platforms. |
| Kernel version | Requires a Linux kernel that supports `io_uring` (5.1 or newer). |
| Memory locking | The implementation locks memory for buffer pools. The process may need sufficient `memlock` limits; CI tests use `sudo prlimit --memlock=unlimited`. |
| Feature flag | The `uring` feature must be explicitly enabled in `Cargo.toml` or through Cargo feature flags. |
| Threading Model | The `io_uring` reactor is **single‑threaded**. All I/O operations are executed by kernel-internal threadpool, but Zenoh callbacks within a given `Runtime` are processed by a single dedicated thread. This design reduces synchronization overhead but also means that blocking callbacks can stall I/O processing for the entire runtime. |

## Enabling the Feature

To build Zenoh with `io_uring` support, enable the `uring` feature when compiling:

```bash
cargo build --features uring
```

For example, to build the `zenohd` router with `io_uring` support:

```bash
cargo build -p zenohd --features uring
```

When the feature is enabled, Zenoh automatically uses the `io_uring` backend for applicable transports, such as stream/socket-based links. No additional configuration is required.

## How It Works

The `uring` feature introduces a new internal crate, `zenoh-uring`, that encapsulates all `io_uring`-specific logic. Its main components are:

- **Reader**: manages multishot receive operations using `RecvMulti` and a buffer pool. It can handle both single-buffer and fragmented payloads.
- **Writer**: provides zero-copy send operations with support for registered buffers.
- **Buffer arena**: a page-backed arena (`BatchArena`) that allocates pinned memory for `io_uring` provided buffers.
- **Reactor loop**: a dedicated thread runs an `io_uring` event loop that processes completion queue entries, dispatches received data to callbacks, and submits new requests.

The transport layer integrates with the `zenoh-uring` crate through a set of internal APIs. When a socket is created, Zenoh checks whether the `uring` feature is enabled and, if so, registers the socket with the `io_uring` reactor instead of the standard tokio runtime.

## Performance Considerations

- **Latency reduction**: in benchmarks, the `io_uring` backend has shown a 25–50% decrease in end-to-end latency for typical Zenoh workloads.
- **Throughput**: message rates may increase by a few percent due to reduced system call overhead and better batching.
- **Memory footprint**: the buffer arena is sized by default to 4096 entries, each holding a batch of data. This can be tuned by adjusting the `batch_size` and `batch_count` parameters in `Reader::new()`.

## Testing and Validation

The PR includes extensive CI coverage for the `uring` feature. Tests are run on Ubuntu with:

```bash
sudo prlimit --memlock=unlimited --pid=$$
cargo nextest run -p zenoh -F uring
```

Additional tests cover dynamic ports, UDP scenarios, and fragmented payload handling.

## Troubleshooting

### Build fails on non-Linux platforms

The `uring` feature is Linux-only. Ensure you are building on a Linux system or disable the feature with `--no-default-features` if it becomes a default feature in the future.

### `ENOBUFS` or `ENOMEM` errors

These errors usually indicate that the process has exhausted its locked memory limit. Increase the `memlock` limit (for example, `ulimit -l unlimited`) or adjust the buffer arena size.

### `Operation already in progress` or `ECANCELED`

These are internal `io_uring` state errors and should not occur under normal operation. If they appear frequently, report them to the Zenoh team.