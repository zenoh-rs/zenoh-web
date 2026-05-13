---
title: "Zenoh 1.9.x: Longwang"
date: 2026-04-17
menu: "blog"
weight: 20260416
description: "17th April, 2026 -- Paris."
draft: false
---

Zenoh 1.9.x **Longwang** has landed!

Named after the Dragon Kings of Chinese mythology who rule over the seas and control water and weather, Longwang represents this release's ability to support increasingly complex network topologies. Just as the four Dragon Kings each govern their domain while working in harmony, Zenoh 1.9.x brings the power to craft distributed systems with unprecedented flexibility.

This release introduces transformative capabilities for network architecture. The headline feature is **Regions** — a complete reimagining of Zenoh's topology model that breaks free from the traditional three-layer router/peer/client hierarchy. Now you can design arbitrarily deep network structures, configure custom gateway relationships, and scale your deployments beyond the inherent limits of any single kind of topology. This architectural evolution enables everything from edge robotics deployments that connect hubs as clients instead of routers, to massive-scale systems that span multiple subregions at each level.

Beyond regions, we've significantly enhanced QUIC transport with stream multiplexing and mixed reliability support, introduced a new official Go language binding, evolved Zenoh-Pico's threading model for better resource efficiency and significantly improved single-threaded mode capabilities, and released Nuze 0.3.0 with native Zenoh message decoding.

Key highlights of this release include:

* **Regions Architecture**: Arbitrary network topology hierarchies with custom gateway configuration, replacing the fixed router/peer/client model with flexible region trees.
* **QUIC Stream Multiplexing**: Independent QUIC streams per priority level to eliminate head-of-line blocking in mixed-priority traffic.
* **QUIC Mixed Reliability**: Combine reliable streams and best-effort datagrams over a single QUIC connection for optimal performance.
* **Reliable UDP**: Unsecure QUIC mode providing reliability and multiplexing without TLS overhead for trusted environments.
* **Zenoh-Go**: Official, idiomatic Go binding with full API coverage from day one.
* **Zenoh-Pico Async Executor**: Single-threaded task execution reducing resource usage while extending advanced features like advanced pub-sub, connectivity events, auto-reconnection, and peer-to-peer mode to single-threaded environments.
* **Nuze 0.3.0**: Zenoh message decoding and improved matching listener commands in the Nu-powered Zenoh CLI.

Let's dive into the details!

## Regions

Zenoh as a routing protocol weaves together multiple topology types within the same network:
peer-to-peer (clique), link-state (mesh), and brokered (star). Before the introduction of regions 
Zenoh nodes routed messages between routers, peers, and clients using link-state, peer-to-peer, and 
brokered networks, respectively. The different network topologies are organized in a tree hierarchy in order to avoid
loops and support the interest protocol.

Pre-regions Zenoh supported a limited depth of network topology hierarchies: a brokered network is
always a child of a peer-to-peer network or a link-state network and a peer-to-peer network is
always a child of a link-state network. This scheme defines a bound relation between nodes. Routers
are north-bound w.r.t. peers and clients; clients are south-bound w.r.t. peers and routers, etc.

![Pre-regions](../../img/2026-04-16-zenoh-longwang/pre-regions.png)

With regions, Zenoh goes beyond the traditional three-layer router/peer/client
hierarchies. Now, network topology hierarchies can span across an arbitrary number of layers. Zenoh
1.9 however ships with a limitation on bound relations: routers may only sit south of other routers,
which is enforced at establishment time (i.e., Zenoh's "handshake"). Beyond this constraint, you have
complete freedom in designing your region tree architecture.

![Post-regions](../../img/2026-04-16-zenoh-longwang/post-regions.png)

A region may be seen as the set of nodes comprising a network topology. Each element of the tree of
topologies is thus a region. Regions allow you more flexibility when designing your system's _region
tree_.

In a local deployment with a (router) hub utilized for forwarding, discovery and/or cloud
connectivity (e.g. systems based on RMW Zenoh), the hub may be connected to the cloud as a client
instead of a router—something only possible post-regions—thus alleviating the network and compute
resources needed to run a network of connected robots.

The number of nodes in a region tree may be scaled beyond the inherent constraints of the
peer-to-peer, link-state and brokered topologies by increasing the tree's width and/or height.

First, each Zenoh node supports arbitrary arrays of subregions: instead of being limited to—for
example—a single peer-to-peer subregion of hundreds of peers (number of connections grows
quadratically), one may deploy multiple such subregions.

Second, the region tree may be arbitrarily deep. This is important because Zenoh is designed to
lower the overhead of discovery the further you go down the tree: the tree root stores all entities,
while the leaves only store what is strictly necessary.

### Configuration

All Zenoh nodes are technically gateways. _Custom_ gateways are nodes with non-default gateway
configuration. The `region_name` config option is an optional non-empty UTF-8 string of at most 32
bytes. It is conceptually a name used to identify an application's north region. It can be matched
against in gateway configuration to assign remotes a north/south bound.

The `"auto"` preset implements the pre-regions router/peer/client hierarchy. Two nodes with
`gateway.south = "auto"` will form a topology equivalent to pre-regions Zenoh. Custom gateways
override the `"auto"` hierarchy: e.g. a client may be configured to put routers in a subregion of
itself (making them south-bound). Establishment will fail between two custom gateways if they're
both configured to make the other south-bound.

```toml
# Peer config (uses the `"auto"` `gateway.south` preset).

region_name = "all-peers"
connect.endpoints = ["tcp/[::1]:7447"]

# Default (implicitly set) value
# gateway.south = "auto"
```

```toml
# Custom gateway config

mode = "client"
listen.endpoints = ["tcp/[::1]:7447"]

[[gateway.south]]

[[gateway.south.filters]]
region_names = ["all-peers"]
```

In the above example, all peers using the second configuration will be south-bound to the client
using the first configuration. Other filters are supported:

```toml
[[gateway.south.filters]]
interfaces = ["wlan0"]
modes = ["router", "peer"]
zids = ["2377a"]
```

Given a remote R connecting to node N—whether inbound or outbound—to a gateway with custom `gateway.south` configuration:

1. R matches an array of filters in N's configuration if it matches any of them in the definition order.
2. R matches an individual filter in N's configuration if it matches all of its fields (e.g.
   `interfaces` _and_ `modes` _and_ `zids` in the above configuration snippet). Note that omitted
   fields are interpreted as wildcards.
3. R matches an individual field in N's configuration if it matches any of its elements.

A filter may be negated by setting `negated = true`. A negated filter matches a remote if the remote
does not match the filter's other fields. This is useful for "match everyone except" patterns:

```toml
# Put all remotes whose region_name is NOT "backbone" into this south subregion.

[[gateway.south]]

[[gateway.south.filters]]
negated = true
region_names = ["backbone"]
```

**NOTE**: peers connected to multiple gateways require `scouting.gossip.enabled` to be set to `true`
in order for the gateways to de-duplicate data travelling upstream.

### Breaking changes

1. Removed peer failover brokering: users are encouraged to use multiple peer subregions when peers
   don't form a clique.
2. The behavior of liveliness subscribers with `history` set to false was clarified in the
   documentation of Zenoh 1.7. Currently live tokens (i.e. the set of tokens observable through a
   liveliness query) may still be delivered to a subscriber with `history` set to false. Pre-regions
   Zenoh attempted to filter out currently live tokens inconsistently. Post-regions Zenoh simply
   promises not to incur overhead by performing a network-wide liveliness query when you set
   `history` to false—there is no consistency guarantee.
3. The `*` wildcard of the adminspace endpoint `@/<zid>/<mode>/linkstate/*` has changed: instead of
   `peers` and `routers` _region identifiers_ are used (e.g. `south:0:router` and `north`, see below).
4. Default `scouting.*.autoconnect.peer` is changed from `["router", "peer"]` to `["router", "peer",
   "client"]`.
5. Default `scouting.*.autoconnect.client` is changed from `["router"]` to `["router", "peer",
   "client"]`.
6. Default `scouting.multicast.listen.client` is changed from `false` to `true`.
7. `routing.peer` is removed—all peers now operate in peer-to-peer mode.
8. `routing.router.peers_failover_brokering` is removed. Users are expected to migrate non-clique
   peer-to-peer deployments from relying on router failover brokering to instead use multiple peer
   subregions in the router:

   ```toml
   mode = "router"

   [[gateway.south]]

   # Peer with `region_name = "peer-subregion-1"` should form a clique.
   [[gateway.south.filters]]
   region_names = ["peer-subregion-1"]

   [[gateway.south]]

   [[gateway.south.filters]]
   region_names = ["peer-subregion-2"]
   ```

### Region identifiers

- **`north`**: The region of mutually north-bound nodes.
- **`south:<n>:<client|peer|router>`**: For example, `south:3:peer` is the third south-bound peer
  subregion. `n` is the index of the subregion's configuration in the `gateway.south` array.
- **`local`**: Functionally equivalent to `south:<n>:client` but reserved for local sessions.

This syntax is used in adminspace and in logs.

## Improved QUIC support

Zenoh 1.9 introduces two significant enhancements to the QUIC link's capabilities: QUIC stream multiplexing (multistream) which operates independent QUIC streams to reduce head-of-line blocking, and mixed reliability to leverage both QUIC streams and datagrams over a single connection. Both features are compatible with each other, and are negotiated via QUIC ALPN for interoperability between configurations and backwards compatibility.

Additionally, we’ve introduced a reliable UDP link via unsecure QUIC for low-overhead reliable communication in trusted environments, which fully inherits supported QUIC features.

Below are brief descriptions of these new features. Additional details will be available on the [official Zenoh documentation](https://zenoh.io/docs/manual/quic/).

### Stream Multiplexing (Multistream)

Multistream QUIC maps each Zenoh priority level to a dedicated QUIC stream, preventing head-of-line blocking by isolating high-priority traffic from lower-priority flows. Configure it by setting `multistream=[auto|0|1]` in endpoint parameters.

Example: `quic/127.0.0.1:7447?multistream=1`

Default config is set to `auto`, which allows negotiation between peers while maintaining backward compatibility with older Zenoh versions.

### Mixed Reliability

Mixed reliability enables QUIC streams and datagrams over a single connection. Reliable messages (`Reliability::Reliable`) travel over QUIC streams while best-effort messages (`Reliability::BestEffort`) use QUIC datagrams. Enable by adding `mixed_rel=[0|auto|1]` in endpoint configuration. Compatible with multistream QUIC for combined functionality.

Example: `quic/127.0.0.1:7447?mixed_rel=1`

The mixed reliability default config is set to disabled, in order to maintain basic QUIC endpoints as single fully-reliable links. An `auto` setting is available to allow for negotiation of the feature while remaining compatible with peers that disable it or don't support it.

### Reliable UDP via unsecure QUIC

When symmetric encryption’s CPU-overhead is not negligible, unsecure QUIC provides QUIC's reliability, stream multiplexing, and mixed reliability over UDP without TLS encryption. It exposes all data in plaintext and removes TLS authentication, making it vulnerable to a multitude of network attacks. This feature is intended for use in trusted network environments, or simply for prototyping.

Reliable UDP can be enabled by setting `rel=1` in the endpoint's config. It is fully compatible with multistream and mixed reliability.

Example: `udp/localhost:7447?rel=1`, `udp/localhost:7447?rel=1;mixed_rel=1;multistream=1`

## Zenoh-Pico

In Zenoh-Pico v1.9, we significantly reworked background threads running various Zenoh session tasks, including read, lease, accept, reconnect, and others. We switched to using an asynchronous executor which runs all the tasks in a single thread.

Given that there was only a single computationally-intensive task (read) while others were sleeping most of the time, the reduction in number of threads to one does not have any visible impact on performance. At the same time, it requires fewer system resources, which is important for certain microcontrollers. In addition, in case of reconnection, we no longer need to destroy existing threads and spawn new ones. Now the executor simply suspends all network background tasks on connection loss and automatically resumes them once the reconnection task succeeds.

Another advantage is that the executor can be spun manually without any need for a background thread in single-threaded mode, using the session's `z_spin_once` function. This allows us to trivially extend all previously multi-threaded-only functionality such as advanced pub-sub, connectivity events, auto-reconnection, and peer-to-peer mode to the single-threaded case.

The functions previously used to spawn (in multi-threaded mode) or run one instance of a specific task (in single-threaded mode)—such as `zp_start_read_task`, `zp_start_lease_task`, `zp_read`, `zp_send_join`, and `zp_send_keep_alive`—were deprecated (although they should still work as previously).

## New Go Language Binding

Zenoh 1.9.0 welcomes **[zenoh-go](https://github.com/eclipse-zenoh/zenoh-go)** — an official, idiomatic Go binding for Zenoh, made possible through sponsorship by **SoftBank Corp.**

Go developers have long had to reach for the C or C++ bindings to use Zenoh. That changes now. Zenoh-Go wraps [zenoh-c](https://github.com/eclipse-zenoh/zenoh-c) via CGo and exposes a Go-native interface: error returns instead of panics, `defer` for resource cleanup, closures for callbacks, and option types for nullable parameters. The full Zenoh API surface is covered from day one.

We extend our sincere gratitude to SoftBank Corp. for sponsoring the development of zenoh-go, enabling first-class Zenoh support for the Go ecosystem.

### Getting Started

Add zenoh-go to your module:

```bash
go get github.com/eclipse-zenoh/zenoh-go
```

> **Prerequisite:** zenoh-c must be installed on the system, built with unstable API support (`-DZENOHC_BUILD_WITH_UNSTABLE_API=ON`). See the [zenoh-c README](https://github.com/eclipse-zenoh/zenoh-c) for instructions.

#### Publishing Data

```go
session, err := zenoh.Open(zenoh.NewDefaultConfig(), nil)
if err != nil {
    log.Fatal(err)
}
defer session.Drop()

keyexpr, _ := zenoh.NewKeyExpr("demo/example/zenoh-go-pub")

pub, err := session.DeclarePublisher(keyexpr, nil)
if err != nil {
    log.Fatal(err)
}
defer pub.Drop()

pub.Put(zenoh.NewZBytesFromString("Hello from Go!"), nil)
```

#### Subscribing to Data

```go
session, err := zenoh.Open(zenoh.NewDefaultConfig(), nil)
if err != nil {
    log.Fatal(err)
}
defer session.Drop()

keyexpr, _ := zenoh.NewKeyExpr("demo/example/**")

sub, err := session.DeclareSubscriber(keyexpr, zenoh.Closure[zenoh.Sample]{
    Call: func(sample zenoh.Sample) {
        fmt.Printf(">> Received ('%s': '%s')\n",
            sample.KeyExpr().String(),
            sample.Payload().String())
    },
}, nil)
if err != nil {
    log.Fatal(err)
}
defer sub.Drop()

// Block until CTRL-C
stop := make(chan os.Signal, 1)
signal.Notify(stop, os.Interrupt)
<-stop
```

### What's Included

Zenoh-Go ships with a full set of examples covering the entire API:

- **Pub/Sub** — `z_pub`, `z_sub`, `z_put`, `z_delete`
- **Query/Reply** — `z_get`, `z_querier`, `z_queryable`, `z_storage`
- **Liveliness** — `z_liveliness`, `z_sub_liveliness`, `z_get_liveliness`
- **Advanced Pub/Sub** — `z_advanced_pub`, `z_advanced_sub` with history and miss detection
- **Matching status** — publisher-side awareness of matching subscribers
- **Connectivity API** — `z_info` with transport and link inspection
- **Scout** — `z_scout` for peer and router discovery
- **Benchmarks** — `z_pub_thr`, `z_sub_thr`, `z_ping`, `z_pong`
- **Serialization** — `z_bytes` demonstrating ZBytes encoding/decoding

You can find all examples in the [examples/](https://github.com/eclipse-zenoh/zenoh-go/tree/main/examples) directory of the repository.

## Nuze 0.3.0

This version of [Nuze](https://github.com/ZettaScaleLabs/nuze) updates Zenoh from 1.7.1 to 1.9.0 and updates Nu from 0.106.1 to 0.112.1.

A new experimental command is added: `zenoh decode`, which allows you to easily decode byte payloads of Zenoh scouting or transport messages and natively manipulate them as Nu records.

The `zenoh {pub,querier} matching-status` experimental commands are replaced by `zenoh {pub,querier} matching-listener`, which returns a stream of updates instead of querying the current matching status and returning.

The Nuze CLI now supports the `--include-paths (-I)` option (analogous to Nushell’s). This is a comma-delimited list of module paths included at startup in the Nuze context.

## Changelogs

The full changelog for every Zenoh repository is available at the following links:

[Rust](https://github.com/eclipse-zenoh/zenoh/releases) | [C](https://github.com/eclipse-zenoh/zenoh-c/releases) | [C++](https://github.com/eclipse-zenoh/zenoh-cpp/releases) | [Python](https://github.com/eclipse-zenoh/zenoh-python/releases) | [Java](https://github.com/eclipse-zenoh/zenoh-java/releases) | [Kotlin](https://github.com/eclipse-zenoh/zenoh-kotlin/releases) | [TypeScript](https://github.com/eclipse-zenoh/zenoh-ts/releases) | [Pico](https://github.com/eclipse-zenoh/zenoh-pico/releases) | [DDS plugin](https://github.com/eclipse-zenoh/zenoh-plugin-dds/releases) | [ROS2 plugin](https://github.com/eclipse-zenoh/zenoh-plugin-ros2dds/releases) | [MQTT plugin](https://github.com/eclipse-zenoh/zenoh-plugin-mqtt/releases) | [WebServer plugin](https://github.com/eclipse-zenoh/zenoh-plugin-webserver/releases) | [Filesystem backend](https://github.com/eclipse-zenoh/zenoh-backend-filesystem/releases) | [RocksDB backend](https://github.com/eclipse-zenoh/zenoh-backend-rocksdb/releases) | [S3 backend](https://github.com/eclipse-zenoh/zenoh-backend-s3/releases) | [InfluxDB backend](https://github.com/eclipse-zenoh/zenoh-backend-influxdb/releases)

Zenoh 1.9.x **Longwang** marks a pivotal evolution in distributed systems architecture. This release fundamentally transforms how you architect Zenoh networks, giving you the flexibility to design topologies that match your system's needs rather than conforming to rigid hierarchies. Whether you're building edge robotics systems with novel hub-to-cloud patterns, scaling to hundreds of nodes across multiple subregions, or optimizing transport performance with QUIC multiplexing, Longwang provides the tools to command your distributed infrastructure with precision.

The new Regions architecture opens up deployment patterns that were simply impossible before, while improvements across QUIC transport, language bindings, and Zenoh-Pico ensure that performance and developer experience keep pace with these architectural advances. From the new Go binding bringing idiomatic Zenoh to Go developers, to the async executor making single-threaded embedded deployments more capable than ever, this release delivers enhancements across the entire ecosystem.

We're excited to see what network architectures you'll design with these new capabilities. As always, your feedback, contributions, and real-world deployment stories help shape the future of Zenoh. Join the conversation, share your experiences, and help us continue making Zenoh better for everyone.

You can reach us on [Zenoh's Discord server](https://discord.com/invite/vSDSpqnbkm)!

Like the Dragon Kings orchestrating the waters with wisdom and power, may your systems flow harmoniously across any topology,

**– The Zenoh Team**
