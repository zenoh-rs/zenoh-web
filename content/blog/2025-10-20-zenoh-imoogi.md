---
title: "Zenoh 1.6.1: Imoogi"
date: 2025-10-02
menu: "blog"
weight: 20251020
description: "20th October, 2025 -- Paris."
draft: false
---

We are excited to announce the release of Zenoh 1.6.1 – **Imoogi**!

Named after the Korean dragon that ascends to greatness, this release elevates the Zenoh ecosystem with powerful refinements and critical improvements. Imoogi focuses on stabilizing and extending the groundbreaking features introduced in version 1.5.0, bringing enhanced shared memory capabilities, improved configuration management, better scalability, and expanded language binding support.

Key highlights of this release include:

* **Shared Memory Evolution**: Comprehensive SHM API improvements with typed buffers, better allocator performance, flexible allocation builders, buffer resize capabilities, and implicit SHM optimization for large payloads — delivering 10-100% throughput improvements.
* **Configuration Consistency**: Refined configuration parameters for improved usability, including renamed `congestion_control` values and enhanced downsampling controls.
* **Extended Language Support**: Full shared memory API introduced in Zenoh-Python, comprehensive SHM updates in Zenoh-C, matching API in Zenoh-TS, and streamlined plugin interfaces.
* **Zenoh-Pico Enhancements:** Advanced Pub/Sub support with TLS security, bringing enterprise-grade security and reliability features to constrained devices.
* **Scalability Enhancements**: Fixed critical peer-to-peer topology issues and optimized discovery message processing, drastically reducing CPU consumption especially for ROS 2 use cases.
* **Nu Integration:** Nuze combines Nushell's powerful structured data scripting with Zenoh commands, providing a convenient tool for testing, debugging, and building interactive Zenoh applications.
* **Documentation & Tooling**: Significantly expanded Rust documentation with usage examples and cross-references, improved README structure, Rust 1.75 compatibility enhancements, and better plugin diagnostics.

Let's explore what Imoogi brings to the Zenoh ecosystem!

# Zenoh

## SHM Improvements

### Typed SHM Buffers

Zenoh 1.5 introduced a fully **generic, typed** shared-memory API. All SHM buffer traits are now generic over the data type, and a new `Typed<T, …>` wrapper provides a high-level, type-safe view over the raw SHM buffer [(PR)](https://github.com/eclipse-zenoh/zenoh/pull/2034). In other words, you can treat a shared buffer almost like a Rust struct. For example, if you have a C-compatible struct:

```rust
#[repr(C)]
struct MyData { x: u32, y: u16 }
```

you can build a layout and allocate a buffer for it, then wrap it in `Typed<MyData, …>` to access fields safely:

```rust
let layout = TypedLayout::<MyData>::new();
let mut typed_buf: Typed<MyData, ZShmMut> = provider
    .alloc(layout)
    .wait()
    .unwrap()
    .assume_init();
typed_buf.as_mut().x = 42;    // safe, typed access
```

Under the hood, this enforces the correct alignment and size for `MyData`, avoiding manual casting.

### Improved Allocator

The SHM allocator is now based on the [talc](https://crates.io/crates/talc) allocator and performs much more efficiently in real-world workload scenarios, addressing performance and fragmentation issues.

### Improved Allocation Builder Ergonomics

Allocation builders are now much simpler and more robust. The provider's `alloc` method is generic and accepts different layout descriptions such as `usize`, `(usize, AllocAlignment)`, and `MemoryLayout`.

```rust
// Option 1: Simple allocation
let _shm_buf = provider.alloc(512).wait()?;
// Option 2: Allocation with custom alignment
let _shm_buf = provider
            .alloc((512, AllocAlignment::ALIGN_2_BYTES))
            .wait()?;
/// Layout allocation:
let layout = provider.alloc_layout(512)?;
let _shm_buf = layout.alloc().wait()?;
```



### Buffer Layout, Resize and Safety

The SHM API rework also clarified *owned vs. borrowed* buffers and added dynamic operations. Notably, you can now **resize a shared buffer in place**, which wasn't previously possible. For example, after allocating a buffer you can:

```rust
shm_buf.try_resize(new_len)?;
```

to grow or shrink it (within its segment's limits).

We also expose alignment defaults and constants (`ALIGN_N_BYTE(S)`) and have tightened lifetime management: SHM buffers now own their segment handle to ensure proper cleanup. New unchecked mutability methods (`as_mut_unchecked()`) were added for cases where you *know* a mutable borrow is safe. Overall, these API changes make working with SHM buffers more predictable and idiomatic to Rust.

### Implicit SHM Optimization

Perhaps the most exciting change is that Zenoh now **automatically uses shared memory for large data**. In practice, this means you don't have to do anything special: if you publish a large payload, Zenoh will "implicitly pack" it into SHM and transmit just a reference locally. For example:

```rust
let large_data = vec![0u8; 1_000_000];   // 1 MB payload
publisher.put(large_data).await.unwrap();
// Zenoh will use SHM under the hood for this large message.
```

This implicit SHM transport applies in all modes (even when using a router), vastly improving throughput for local messages. In benchmark tests, the combined SHM changes provided approximately **10–100% throughput boost** (depending on message size).

Latency improvement:

![Implicit SHM Latency Improvement](../../img/20251020-zenoh-imoogi/shm_latency_imp.png)

Throughput improvement:

![Implicit SHM Throughput Improvement](../../img/20251020-zenoh-imoogi/shm_throughput_imp.png)

### SHM Performance

Latency:

![SHM Latency Performance](../../img/20251020-zenoh-imoogi/shm_latency_perf.png)

Throughput:

![SHM Throughput Performance](../../img/20251020-zenoh-imoogi/shm_throughput_perf.png)

Note: throughput decreases for payloads larger than 2 MB due to insufficient memory arena capacity.

### SHM monitoring

#### TransportSession SHM indicator

A boolean field has been added to the `session` object of the AdminSpace report indicating whether SHM is enabled for the relevant TransportSession.

```json
[
   {
       "key": "@/aaaaaaaaaaaaaaaa/router",
       "value": {
           "sessions": [
               {
                   "peer": "bbbbbbbbbbbbbbbb",
                   "shm": "true",
                   "whatami": "client",
                   ...
               }
           ],
           ...
       },
       ...
   }
]
```

#### SHM related statistics

The statistics reports have been updated to distinguish between network messages sent and received through SHM and those sent and received through the network.

In the JSON report:

```json
"stats": {
    "rx_n_msgs": {
        "net": 4,
        "shm": 12
    },
    "tx_n_msgs": {
        "net": 20,
        "shm": 45
    },
    ...
}
```

In the OpenMetrics report:

```prometheus
# HELP rx_n_msgs Counter of received network messages.
# TYPE rx_n_msgs counter
rx_n_msgs 16
rx_n_msgs{media="net"} 4
rx_n_msgs{media="shm"} 12
# HELP tx_n_msgs Counter of sent network messages.
# TYPE tx_n_msgs counter
tx_n_msgs 65
tx_n_msgs{media="net"} 20
tx_n_msgs{media="shm"} 45
```

Note: to enable statistics, Zenoh has to be built with the `stats` feature.

## Configuration changes

In version 1.6.1, we introduced minor modifications to the Zenoh configuration to improve its overall consistency:

* The unstable `congestion_control` value "blockfirst" was renamed to "block_first".
* The "downsampling/messages" value "push" has been deprecated and may no longer be supported in future versions. It has been replaced with "put" and "delete" values (similar to other interceptors), which allow separate control of the publishing frequency for PUT and DELETE messages.

## Scalability improvements

In version 1.6.1, we fixed a bug that was causing an infinite loop of messages across multiple processes in a peer-to-peer topology [(PR)](https://github.com/eclipse-zenoh/zenoh/pull/214). We also applied various optimizations that reduce CPU consumption for discovery message processing [(PR)](https://github.com/eclipse-zenoh/zenoh/pull/2174).

Overall, these changes drastically reduced CPU consumption and significantly improved Zenoh scalability, especially in peer-to-peer scenarios and the rmw_zenoh use case.

## Rust 1.75 compatibility improvement

The **zenoh** crate is declared to be compatible with Rust 1.75. Unfortunately, the Rust version compatibility checker ignores the fact that dependent crates evolve, and a crate that worked with Rust 1.75 at one point may later fail to compile because some of its dependencies have bumped their minimum supported versions.

One possible solution would be to use pinned dependencies (e.g., `"=0.1.2"`) in zenoh itself, but this approach can cause compatibility issues.

The solution is to include an additional crate, [zenoh-pinned-deps-1-75](https://crates.io/crates/zenoh-pinned-deps-1-75), which pins all failing dependencies (as of the time of release 😭) to versions compatible with Rust 1.75.

## Documentation improvements

The [Rust documentation](https://docs.rs/zenoh/latest/zenoh/) has been significantly extended. Introductory paragraphs with usage examples were added to the main page and each module. Features were documented, and functions and types were cross-linked to ensure that users would not get lost when encountering a type without knowing its purpose or how to use it.

The project's [README](https://github.com/eclipse-zenoh/zenoh/blob/main/README.md) was also improved and systematized. Each component now has its own README, with the root README linking to all of them.

# Zenoh-Pico

## Advanced Pub/Sub

Zenoh-Pico now includes support for the Advanced Publisher and Subscriber, bringing it in line with core Zenoh, where this functionality was first introduced in version [1.1.0](https://zenoh.io/blog/2024-12-12-zenoh-firesong-1.1.0/).

This version introduces:

* An Advanced Publisher that can:
    * Cache the last published samples to support history or recovery for Advanced Subscribers.
    * Sequence samples to enable detection of missed samples.
    * Automatically create a liveliness token to assert its presence and allow matching subscribers to detect availability.
    * Send heartbeat messages (periodically or sporadically) to inform subscribers about available samples for recovery — ensuring end-to-end reliability even if the last sample was lost or no new samples are published.
* An Advanced Subscriber that can:
    * Retrieve historical data from Advanced Publishers.
    * Detect missed samples and optionally recover them.
    * Monitor matching publishers’ liveliness to query history for late joiners.
    * Use heartbeat updates to maintain synchronisation with Advanced Publishers without relying on periodic queries.

The API is consistent with the Zenoh-C implementation first introduced in [Zenoh Gozuryū](https://zenoh.io/blog/2025-04-14-zenoh-gozuryu/). Note that in addition to starting the read and lease tasks, you must also start the periodic scheduler task when using the Advanced Publisher or Subscriber:

```c
z_result_t res = zp_start_periodic_scheduler_task(z_loan_mut(s), NULL);
```

Complete examples can be found at [z_advanced_pub.c](https://github.com/eclipse-zenoh/zenoh-pico/blob/main/examples/unix/c11/z_advanced_pub.c) and [z_advanced_sub.c](https://github.com/eclipse-zenoh/zenoh-pico/blob/main/examples/unix/c11/z_advanced_sub.c).

## Mbed TLS Support

Secure communication is essential for IoT deployments, especially when connecting devices to cloud platforms or transmitting sensitive data. With this release, Zenoh-Pico brings enterprise-grade security to constrained devices through TLS and mutual TLS (mTLS) support via Mbed TLS.

TLS provides encryption and server authentication, ensuring that your devices communicate securely over untrusted networks. Mutual TLS goes further by requiring both client and server to authenticate each other with certificates, providing strong device identity verification—a critical requirement for production IoT deployments and cloud platforms like the Zetta Platform PaaS.

Zenoh-Pico now supports TLS via Mbed TLS in both client and peer modes. Enable it at build time with `Z_FEATURE_LINK_TLS=1` and use `tls/<host>:<port>` locators. This feature is currently available for Unix platforms.

### Certificate Validation and Security

The TLS implementation includes robust security features:

* **Certificate chain validation**: Required by default. Provide a CA bundle using `Z_CONFIG_TLS_ROOT_CA_CERTIFICATE_KEY` (or the inline `*_BASE64_KEY` variant for embedded certificates).
* **Hostname verification**: Automatically validates the server certificate's Common Name (CN) and Subject Alternative Name (SAN) against the hostname. This can be disabled if needed via `Z_CONFIG_TLS_VERIFY_NAME_ON_CONNECT_KEY`.
* **Mutual TLS (mTLS)**: Full support for client certificate authentication, enabled with `Z_CONFIG_TLS_ENABLE_MTLS_KEY=true`.

### Configuration Options

**For peer mode (listening)**:

Configure your server certificate and private key with `Z_CONFIG_TLS_LISTEN_CERTIFICATE_{KEY,BASE64_KEY}` and `Z_CONFIG_TLS_LISTEN_PRIVATE_KEY_{KEY,BASE64_KEY}`.

**For client mode with mTLS**:

Configure your client certificate and private key with `Z_CONFIG_TLS_CONNECT_CERTIFICATE_{KEY,BASE64_KEY}` and `Z_CONFIG_TLS_CONNECT_PRIVATE_KEY_{KEY,BASE64_KEY}`.

All configuration options are fully documented in `docs/config.rst`.

### Example Configuration

Here's a complete example showing client-side mTLS with inline base64-encoded certificates:

```c
z_owned_config_t cfg;
z_config_default(&cfg);
// Connect to TLS endpoint
zp_config_insert(z_loan_mut(cfg), Z_CONFIG_CONNECT_KEY, "tls/127.0.0.1:7447");
// Set CA certificate for server validation
zp_config_insert(z_loan_mut(cfg), Z_CONFIG_TLS_ROOT_CA_CERTIFICATE_KEY, "/home/user/client/minica.pem");
// Enable mutual TLS
zp_config_insert(z_loan_mut(cfg), Z_CONFIG_TLS_ENABLE_MTLS_KEY, "true");
// Set client credentials
zp_config_insert(z_loan_mut(cfg), Z_CONFIG_TLS_CONNECT_PRIVATE_KEY_BASE64_KEY, client_key_base64);
zp_config_insert(z_loan_mut(cfg), Z_CONFIG_TLS_CONNECT_CERTIFICATE_BASE64_KEY, client_cert_base64);
// Disable hostname verification (testing only)
zp_config_insert(z_loan_mut(cfg), Z_CONFIG_TLS_VERIFY_NAME_ON_CONNECT_KEY, "false");
```

Complete working examples for publishing and subscribing over TLS can be found in `examples/unix/c11/z_pub_tls.c` and `examples/unix/c11/z_sub_tls.c`.

## zp_read Optimization

The `zp_read` function has undergone significant optimization in this release, addressing critical performance and reliability issues that affected applications processing high message throughput. These improvements come from two complementary enhancements that transform how Zenoh-Pico handles network data.

### Batch Processing for Improved Throughput

The original `zp_read` implementation processed only a single message per call, creating a significant performance bottleneck. Applications had to repeatedly call `zp_read` to drain the network buffer, and when messages arrived faster than they could be processed one-by-one, TCP buffers would overflow, causing data corruption.

The new default behavior processes all available messages in the buffer in a single `zp_read` call. This batch processing approach:

* **Prevents TCP buffer overflow**: By draining the network buffer faster, the risk of overflow and resulting data corruption is eliminated
* **Improves throughput**: Reduces syscall overhead and processes multiple messages efficiently
* **Maintains backward compatibility**: Applications requiring the old behavior can set `single_read = true` in the options

**API Changes:**

```c
typedef struct {
    bool single_read;  // Read a single packet instead of the whole buffer
} zp_read_options_t;
// Default is batch processing (single_read = false)
void zp_read_options_default(zp_read_options_t *options) {
    options->single_read = false;
}
```

The implementation now efficiently processes all messages in both unicast and multicast transport modes.

More details can be found in this [PR](https://github.com/eclipse-zenoh/zenoh-pico/pull/1004).

### No-Data Notification

After changing `zp_read` to batch processing, applications needed a way to distinguish between successful operations that processed data and calls where no data was available. Previously, both scenarios returned `Z_OK`, making it impossible to implement efficient polling strategies or detect when the network buffer was empty.

A new result code `Z_NO_DATA_PROCESSED` was introduced specifically for this scenario.

This enhancement enables applications to implement smarter polling strategies and optimize resource usage:

```c
z_result_t result = zp_read(session, NULL);
if (result == Z_NO_DATA_PROCESSED) {
    // No data available, can back off or sleep
    // Perfect for power-constrained devices
} else if (result == Z_OK) {
    // Data was processed, might want to read again immediately
} else {
    // Handle error (result < 0)
}
```

**Benefits:**

* **Efficient polling**: Applications can avoid tight polling loops when no data is available.
* **CPU usage optimization**: Reduces unnecessary processing cycles.
* **Better diagnostics**: Developers can distinguish between successful operations and empty reads.
* **Power efficiency**: Particularly valuable for embedded and battery-powered devices.

More details can be found in this [PR](https://github.com/eclipse-zenoh/zenoh-pico/pull/1022).

### Impact

Together, these optimizations provide:

* **Better performance** through batch processing of network buffers.
* **Better reliability** by preventing TCP buffer overflow and data corruption.
* **Better diagnostics** through explicit no-data signaling.
* **Better resource efficiency** through smarter polling strategies.

These changes are particularly impactful for:

* High-throughput applications processing many small messages.
* Embedded systems with constrained resources.
* Event-driven applications that need efficient idle behavior.
* Applications running on congested or unreliable networks.

# Zenoh-Python

## Introduce SHM API

A shared memory API has been added to zenoh-python, allowing you to allocate and write to shared-memory segments before sending them through Zenoh.

```python
# Create a provider with 1 MB buffer
provider = zenoh.shm.ShmProvider.default_backend(1024 * 1024)

payload = b"shared memory payload"

# Allocate buffer with garbage collection policy
sbuf = provider.alloc(
   len(payload), policy=zenoh.shm.BlockOn(zenoh.shm.GarbageCollect())
)

# Write data to shared buffer
sbuf[:] = payload

# Publish - subscribers in the same host will access via shared memory
session.put(sbuf)
```

# Zenoh-C

The SHM API has been updated to align with recent changes in the Rust API, specifically the renaming of `alloc_layout` to `precomputed_layout`. While the renamed items are deprecated, they remain accessible to facilitate a smoother migration process for developers.

For example:

```c
// Old API (deprecated but still available)
z_owned_alloc_layout_t alloc_layout;
z_alloc_layout_with_alignment_new(&alloc_layout, z_loan(*provider), buf_ok_size, alignment));

// New API (recommended)
z_owned_precomputed_layout_t precomputed_layout;
z_shm_provider_alloc_layout_aligned(&precomputed_layout, z_loan(*provider), buf_ok_size, alignment));
```

# Zenoh-TS

## Introduce Matching API

We added the last missing part of core Zenoh functionality - matching listener and matching status for Publisher and Querier in Zenoh-TS 1.6.1. Similarly to other languages, the new API can be used as follows:

```typescript
const publisher: Publisher = await session.declarePublisher(keyExpr);
const listenerCallback = function (status: MatchingStatus) {
  if (status.matching()) {
    console.warn("Publisher has matching subscribers.")
  } else {
    console.warn("Publisher has NO MORE matching subscribers")
  }
};

let matchingListener = await publisher.matchingListener({handler: listenerCallback });
// Now every time matching status of publisher changes (i.e. first subscriber connects, or last one disconnects) a listenerCallback will be triggered

// Alternatively it is also possible to access matching status of publisher at any moment of time using
let matchingStatus = publisher.matchingStatus().await;
```

# Plugin API Update

Prior to 1.6.1, due to the absence of a stable ABI in Rust, it was necessary to ensure that plugins and zenohd were built with the same version of Rust, the same Zenoh version and features, and additionally that all common dependency crates of plugins and Zenoh (such as ***serde*** or ***tokio***) had the same version and contained exactly the same features. The last requirement was especially difficult to satisfy.

In the new version, we reworked the plugin interface, and it should no longer be necessary to satisfy the last constraint.

The requirement for the same version of Rust and the same Zenoh version and features still remains, but the diagnostics for such mismatches have also been improved.

# Nuze: Nu meets Zenoh

Nu is the powerful scripting language underlying [Nushell](https://www.nushell.sh/). In Nu, everything is *structured* data in the form of [tables](https://www.nushell.sh/lang-guide/chapters/types/basic_types/table.html). This allows commands to pipeline in a natural, robust, and consistent way. Tables are a particularly great fit for Zenoh data: sample streams are tables where each column represents a sample property (e.g., key-expression, timestamp, encoding, etc.).

Nuze (/nuz/) embeds the upstream Nu engine and extends it with Zenoh commands through the Rust bindings. The result is a single standalone executable that combines Nushell functionality with an extensive collection of custom Zenoh commands. The Asciinema recording below illustrates the use of Nuze to declare a queryable and send a query to it:

[![asciicast](https://asciinema.org/a/Uy6yvpT86vWzYW5DmWBfLcc8V.svg)](https://asciinema.org/a/Uy6yvpT86vWzYW5DmWBfLcc8V)

Nuze was conceived to facilitate testing and debugging of Zenoh applications: it is a convenient tool to write end-to-end tests and quickly poke into a Zenoh network. It also (unsurprisingly) serves as a powerful building block for interactive Zenoh applications in a given domain.

Nuze currently lives in [https://github.com/ZettaScaleLabs/nu-zenoh](https://github.com/ZettaScaleLabs/nu-zenoh) and is based on [Nushell 0.106.1](https://www.nushell.sh/blog/2025-07-30-nushell_0_106_1.html) as of commit `578316b`; see the repository [README](https://github.com/ZettaScaleLabs/nu-zenoh?tab=readme-ov-file#nuze-zenoh-nu-shell) for installation and usage instructions.

# Changelogs

The effort behind Zenoh 1.6.1 **Imoogi** has resulted in numerous bug fixes and improvements across the ecosystem. The full changelog for every Zenoh repository is available at the following links:

[Rust](https://github.com/eclipse-zenoh/zenoh/releases) | [C](https://github.com/eclipse-zenoh/zenoh-c/releases) | [C++](https://github.com/eclipse-zenoh/zenoh-cpp/releases) | [Python](https://github.com/eclipse-zenoh/zenoh-python/releases) | [Java](https://github.com/eclipse-zenoh/zenoh-java/releases) | [Kotlin](https://github.com/eclipse-zenoh/zenoh-kotlin/releases) | [TypeScript](https://github.com/eclipse-zenoh/zenoh-ts/releases) | [Pico](https://github.com/eclipse-zenoh/zenoh-pico/releases) | [DDS plugin](https://github.com/eclipse-zenoh/zenoh-plugin-dds/releases) | [ROS2 plugin](https://github.com/eclipse-zenoh/zenoh-plugin-ros2dds/releases) | [MQTT plugin](https://github.com/eclipse-zenoh/zenoh-plugin-mqtt/releases) | [WebServer plugin](https://github.com/eclipse-zenoh/zenoh-plugin-webserver/releases) | [Filesystem backend](https://github.com/eclipse-zenoh/zenoh-backend-filesystem/releases) | [RocksDB backend](https://github.com/eclipse-zenoh/zenoh-backend-rocksdb/releases) | [S3 backend](https://github.com/eclipse-zenoh/zenoh-backend-s3/releases) | [InfluxDB backend](https://github.com/eclipse-zenoh/zenoh-backend-influxdb/releases)

We're excited to see what you'll build with these enhancements. As always, your feedback, contributions, and success stories help shape the future of Zenoh. Join the conversation, share your experiences, and help us continue making Zenoh better for everyone.

You can reach us on [Zenoh's Discord server](https://discord.com/invite/vSDSpqnbkm)!

Like the Imoogi ascending to become a true dragon, may your systems rise to new heights,

**– The Zenoh Team**

