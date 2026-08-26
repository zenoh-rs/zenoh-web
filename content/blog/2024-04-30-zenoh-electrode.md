---
date: "2024-05-13"
title: 'Zenoh 0.11.0 "Electrode" release is out!'
description: "Paris — 13 May 2024"
menu: "blog"
weight: 20240512
---

During the summer of 2023, we rolled out Zenoh v0.7.0 'Charmander,' which brought significant enhancements to the Zenoh ecosystem. This was followed by the release of v0.10.0-rc 'Dragonite' in autumn, and a winter update with v0.10.1-rc.
This spring, we are pleased to announce Zenoh v0.11.0 “Electrode”. This release introduces several new features, some key improvements. Next will come the much-anticipated version 1.0.0, planned for June 2024🎉!

But let’s see what comes with Zenoh Electrode.

{{< figure-inline
    src="../../img/20240430-blog-zenoh-electrode/comic-april-2024.png"
    class="responsive-figure figure-inline"
    alt="Zenoh comic April 2024"
    width="100%" >}}

{{< rawhtml >}}

<style>
.responsive-figure {
    display: flex;
    justify-content: center;
}

.responsive-figure img {
    max-width: 720px;
    height: auto;
}
</style>

{{< /rawhtml >}}

---

# Android, Kotlin and Java

{{< figure-inline
    src="../../img/20240430-blog-zenoh-electrode/zenoh-kotlin-header.png"
    class="responsive-figure figure-inline"
    alt="Zenoh kotlin header"
    width="100%" >}}

Back in September we announced that after C, C++ and Python, you could now use Zenoh with Kotlin (checkout the [repository](https://github.com/eclipse-zenoh/zenoh-kotlin)).

However there were some important aspects to tackle.

To begin with, the 0.10.0-rc Zenoh-Kotlin release target was limited to JVM. But you may have asked yourself “what about Android?”... Indeed, on this release we got your back covered ;-). We have refactored the build scripts in order to integrate the [Kotlin Multiplatform Plugin](https://kotlinlang.org/docs/multiplatform-plugin-releases.html), which allows us to have a common codebase to be reused across multiple targets, with some specificity for each. Therefore, we now can build Zenoh-Kotlin for both Android and JVM targets.

Additionally, we now provide packaging, which is key to ease the importing of Zenoh on Kotlin projects. Find them out here on [Github Packages](https://github.com/orgs/eclipse-zenoh/packages?repo_name=zenoh-kotlin), for both JVM and Android targets!

The third important item is that Java joined the party! Indeed, we have forked the Kotlin bindings, making the necessary adjustments to make the bindings fully Java compatible. Checkout the examples! [https://github.com/eclipse-zenoh/zenoh-java/tree/main/examples](https://github.com/eclipse-zenoh/zenoh-java/tree/main/examples)

Because Zenoh-Kotlin (and now Zenoh-Java) relies on the Zenoh-JNI native library, we need to take into consideration the platforms on top of which the library is going to run.

For Android, we support the following architectures:

- x86
- x86_64
- arm
- arm64

While for JVM we support:

- x86_64-unknown-linux-gnu
- aarch64-unknown-linux-gnu
- x86_64-apple-darwin
- aarch64-apple-darwin
- x86_64-pc-windows-msvc

Take a look at the [Zenoh demo app](https://github.com/eclipse-zenoh/zenoh-demos/tree/main/zenoh-android/ZenohApp) we have published to see how to use the package:

{{< rawhtml >}}

<style>
.responsive-video {
    position: relative;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    height: 0;
    overflow: hidden;
    background: #000;
}

.responsive-video video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
</style>

<div class="responsive-video figure-inline">
    <video controls>
        <source src="../../img/20240430-blog-zenoh-electrode/android_demo.webm" type="video/webm">
        <a href="../../img/20240430-blog-zenoh-electrode/android_demo.webm">android_demo.webm</a>
    </video>
</div>

{{< /rawhtml >}}

_In this example we communicate from an Android phone using the Zenoh Kotlin bindings to a computer using the Zenoh Rust implementation, reproducing a publisher/subscriber example._

You can also see a live demo we did during the Zenoh User Meeting of an android application using the kotlin bindings to control a turtlebot: [https://youtu.be/oaRe2bkIyIo?feature=shared&t=15268](https://youtu.be/oaRe2bkIyIo?feature=shared&t=15268)

# ROS 2 Plug-in

[https://github.com/eclipse-zenoh/zenoh-plugin-ros2dds](https://github.com/eclipse-zenoh/zenoh-plugin-ros2dds)

We have had a Zenoh Bridge/Plug-in for DDS for some time. This plug-in has been heavily used by numerous robotic applications in overcoming [wireless connectivity](https://zenoh.io/blog/2021-03-23-discovery/), [bandwidth](https://zenoh.io/blog/2021-09-28-iac-experiences-from-the-trenches/), and [integration](https://zenoh.io/blog/2021-11-09-ros2-zenoh-pico/) challenges. Yet, this plugin was for generic DDS applications and was not leveraging some of the semantics that are specific to ROS2. This is why we decided to do a new plugin/bridge optimized for ROS2, which provides the following features:

- Better integration of the ROS 2 graph, allowing visibility of all ROS topics, services, and actions across multiple bridges.
- Improved compatibility with ROS 2 tooling such as `ros2`, `rviz2` and more.
- Configuration of a ROS 2 namespace on the bridge, eliminating the need to configure it individually for each ROS 2 node.
- Simplified integration with Zenoh native applications, with services and actions being mapped to Zenoh Queryables.
- Streamlined exchange of discovery information between bridges, resulting in more compact data exchanges.
- Even better performance than the DDS plugin/bridge!

# InfluxDB v2.x Plug-in

[https://github.com/eclipse-zenoh/zenoh-backend-influxdb](https://github.com/eclipse-zenoh/zenoh-backend-influxdb)

The release extends the support to InfluxDB v2.x. Our plugin maintains support v1.x for our users that are still on the old version of the database. For InfluxDB 2.x backend we have implemented the following features:

- Support for GET, PUT and DELETE queries on measurements
- Support for creating and deleting buckets
- Support for access tokens as credentials
- Porting compatibility between InfluxDB 1.x and 2.x storage backends

# Tokio Porting

Back to April 2022, we conducted a[ performance evaluation on Rust asynchronous runtimes](https://zenoh.io/blog/2022-04-14-rust-async-eval/) and chose[ async-std](https://async.rs/) as the Rust async framework for Zenoh. Fast forward two years,[ Tokio](https://tokio.rs/) has grown to become the most extensive asynchronous framework in Rust. As more users adopt Tokio, the ecosystem has expanded with valuable tools and innovative features. We began another thorough performance study a few months ago and the results were enough to prompt us to switch to Tokio. The change of asynchronous runtime is internal and does not affect the user API. Moreover, it offers us cool features like,

**Controllability.** You can adjust the runtime settings through the environmental variable. For instance, controlling the number of worker threads and the maximal blocking threads for the specific zenoh runtimes.

```bash
export ZENOH_RUNTIME='(
 app: (worker_threads: 2),
 tx: (max_blocking_threads: 1)
 )'
```

The configuration syntax follows[ RON](https://github.com/ron-rs/ron) and the available parameters are listed[ here](https://docs.rs/zenoh-runtime/latest/zenoh_runtime/struct.RuntimeParam.html). We plan to enhance our runtime and add more parameters in the future!

**Debugging**

Developers can leverage the tokio-console to monitor the detailed status of each async task. Taking the z_sub as the example,

{{< figure-inline
    src="../../img/20240430-blog-zenoh-electrode/tokio.png"
    class="figure-inline"
    alt="Tokio">}}

To learn how to enable it, please refer to this [tutorial](https://github.com/tokio-rs/console?tab=readme-ov-file#using-it).

# Attachments

Sometimes, you just want to attach some meta-information to your payload, and you really don’t want to add a layer of serialization in order to do so. Well now, you can use the new `attachment` API! Available in the Rust, C, C++, Kotlin and Java APIs, coming to zenoh-pico and other bindings soon; this API lets you attach a list of key-value pairs to your publications, queries and replies.

For instance, this is how you can use attachments with a publisher using Zenoh’s Rust API:

```rust
// Declaring a publisher
let publisher = session.declare_publisher(&key_expr).res().await?;

// Create an attachment by specifying key value pairs to an attachment builder
let attachmentBuilder = AttachmentBuilder::new();
attachmentBuilder.insert("key1", "value1");
attachmentBuilder.insert("key2", "value2");

// Build the attachment
let attachment = attachmentBuilder.build();

// Perform a put using the with_attachment function.
publisher.put("value").with_attachment(attachment).res();
```

The other bindings follow a similar approach, for instance on Kotlin we’d do:

```kotlin
// …
publisher.put(payload).withAttachment(
    Attachment.Builder()
        .add("key1", "value1")
        .add("key2", "value2")
        .res()
).res()
```

# Typescript Bindings

{{< figure-inline
    src="../../img/20240430-blog-zenoh-electrode/zenoh-ts-header.png"
    class="responsive-figure figure-inline"
    alt="Zenoh TypeScript header"
    width="320px">}}

Many of you have asked for the ability to run Zenoh in your browser… Well, that’s coming up!

We have a Typescript API providing the core set of Zenoh features working in the browser, with Node.js support becoming a priority once enough features are stable in the browser.

For now we can offer only a taste of the API that will be presented to developers, but keep in mind this is still in the experimental stage and changes are likely to happen as we continue to develop the bindings.

In its current state it is structured as a Callback API.

Here is a brief example of how Zenoh currently works in a Typescript program:

```ts
import * as zenoh from "zenoh"

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const session = await zenoh.Session.open(zenoh.Config.new("ws/127.0.0.1:10000"))
    // Subscriber Example
    const key_expr: zenoh.KeyExpr = await session.declare_ke("demo/send/to/ts");
    var subscriber = await session.declare_subscriber_handler_async(key_expr,
        async (sample: zenoh.Sample) => {
            const decoder = new TextDecoder();
            let text = decoder.decode(sample.value.payload)
            console.debug("sample: " + sample.keyexpr + "': '" + text);
        }
    );
    // Publisher Example
    const key_expr2 = await session.declare_ke("demo/send/from/ts");
    const publisher : zenoh.Publisher = await session.declare_publisher(key_expr2);
    let enc: TextEncoder = new TextEncoder(); // always utf-8
    let i : number = 0;
    while ( i < 100) {
        let currentTime = new Date().toTimeString();
        let uint8arr: Uint8Array = enc.encode(My Message : ${currentTime} );
        let value: zenoh.Value = new zenoh.Value(uint8arr);
        (publisher).put(value);
        await sleep(1000);
    }
    // Loop to spin and keep Subscriber alive
    var count = 0;
    while (true) {
        var seconds = 10;
        await sleep(1000 * seconds);
        console.log("Main Loop ? ", count)
        count = count + 1;
    }
}
```

# Access Control

As a part of the 0.11.0 release, Zenoh has added the option of access control via network interfaces. It works by restricting actions (eg: put) on key-expressions (eg: test/demo) based on network interface values (eg: lo). The access control is managed by filtering messages (where message types are denoted as actions in the access_control config): `put`, `get`, `declare_subscriber` and `declare_queryable`. The filter can be applied on both incoming (ingress) and outgoing messages (egress).

Enabling access control for the network is a straightforward process: the rules for the access control can be directly provided in the configuration file.

**Access Control Config**

A typical access control configuration in the config file looks as follows:

```json
access_control: {
  "enabled": true,
  "default_permission": "deny",
  "rules":
  [
	{
  	  "actions": ["put", "declare_subscriber"],
  	  "flows":["egress", "ingress"],
  	  "permission": "allow",
  	  "key_exprs": ["test/demo"],
  	  "interfaces": ["lo0"]
	}
   ]
}
```

The configuration has three primary fields:

- **enabled**: _true_ or _false_
- **default_permission**: _allow_ or _deny_
- **rules**: the list of rules for specifying explicit permissions

The _enabled_ field sets the access control status. If it is set to false, no filtering of messages takes place and everything that follows in the access control config is ignored.

The _default_permission_ field provides the implicit permission for filtering messages, i.e., this rule applies if no other matching rule is found for an action. It therefore always has lower priority than explicit rules provided in the _rules_ field.

The _rules_ field itself has sub-fields: _actions_, _flows_, _permission_, _key_exprs_ and _interfaces_. The values provided in these fields set the explicit rules for the access control:

- **actions**: supports four different types of messages - _put_, _get_, _declare_subscriber_, _declare_queryable._
- **flows**: supports _egress_ and _ingress_.
- **permission**: supports _allow_ or _deny._
- **key_exprs**: supports values of any key type or key-expression (set of keys) type, eg: “_temp/room_1_”, “_temp/\*\*_”...etc. (see [Key_Expressions](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Key%20Expressions.md))
- **interfaces**: supports all possible values for network interfaces, eg: “_lo_”, “_lo0_”…etc.

For example, in the above config, the _default_permission_ is set to _deny_, and then a rule is added to explicitly allow certain behavior. Here, a node connecting via the “lo0” interface will be allowed to `put` and `declare_subscriber` on the `test/demo` key expression for both incoming and outgoing messages. However, if there is a node connected via another interface or trying to perform another action (eg: `get`), it will be denied. This provides a granular access control over permissions, ensuring that only authorized devices or networks can perform allowed behavior. More details on this can be found in our [Access Control RFC](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Access%20Control%20Rules.md).

# Downsampling

Downsampling is a feature in Zenoh that allows users to control the flow of data messages by reducing their frequency based on specified rules. This feature is particularly useful in scenarios where high-frequency data transmission is not necessary or desired, such as conserving network bandwidth or reducing processing overhead.

The downsampling configuration in Zenoh is defined using a structured declaration, as shown below:

```json
downsampling: [
  {
    // A list of network interfaces messages will be processed on, the rest will be passed as is.
    interfaces: [ "wlan0" ],
    // Data flow messages will be processed on. ("egress" or "ingress")
    flow: "egress",
    // A list of downsampling rules: key_expression and the maximum frequency in Hertz
    rules: [
      {
        key_expr: "demo/example/zenoh-rs-pub",
        freq: 0.1
      },
    ],
  },
],
```

Let's break down each component of the downsampling configuration:

- **Interfaces**: Specifies the network interfaces on which the downsampling rules will be applied. Messages received on these interfaces will undergo downsampling according to the defined rules.
- **Flow**: Indicates the direction of data flow on which the downsampling rules will be applied. In this example, "egress" signifies outgoing data messages.
- **Rules**: Defines a list of downsampling rules, each consisting of a `key_expression` and a `freq` (frequency) parameter.
  - `key_expression`: Specifies a key expression pattern to match against the data messages. Only messages with keys that match this expression will be subject to downsampling.
  - `freq`: Sets the maximum frequency in Hertz (Hz) at which messages matching the key expression will be transmitted. Any messages exceeding this frequency will be downsampled or discarded.

In the provided example, the downsampling rule targets messages published under the key expression `demo/example/zenoh-rs-pub` for interface wlan0 and restricts their transmission frequency to 0.1 Hz. This means that data messages matching this key expression will be transmitted at a maximum rate of 0.1 Hz, effectively reducing the data flow to the specified frequency.

By configuring downsampling rules, users can effectively manage data transmission rates, optimize resource utilization, and tailor data delivery to meet specific application requirements.

# Ability to bind on an interface

Zenoh introduces advanced capabilities for binding network interfaces in TCP/UDP communication on Linux systems, enabling users to fine-tune network connectivity and optimize resource utilization. This feature facilitates precise control over both outgoing connections and incoming connections, enhancing network security, reliability, and performance in diverse deployment environments.

#### Outgoing Connections

Users can specify the interface to be connected to when establishing TCP/UDP connections, ensuring that connections are established only if the target IP address is reachable via the designated interface. This capability enhances network reliability and efficiency by directing outgoing connections through the most appropriate network path.

For instance:

```json
// connect only if the address 192.168.0.1 is reachable via
// the interface eth0
connect: {
      endpoints: [
           "tcp/192.168.0.1:7447#iface=eth0"
      ],
}
```

#### Incoming Connections

Furthermore, Zenoh allows users to bind connections to specific interfaces for listening purposes, even if the interface is not available at the time of launching Zenoh. By specifying the interface to be listened to when accepting incoming TCP/UDP connections, users can ensure that Zenoh binds to the designated interface when it becomes available.

For instance:

```json
// listen for connections only on interface eth0
// (even if not yet available)
listen: {
      endpoints: [
           "tcp/0.0.0.0:7447#iface=eth0"
      ],
}
```

# Transparent network compression

Transparent compression is now available in Zenoh. This allows two Zenoh nodes to perform transparent hop-to-hop compression at network level when communicating. This can be pretty useful when sending large data over constrained networks like WiFi, 5G, etc.

The following configuration enables hop-to-hop compression:

```json
{
  transport: {
    unicast: {
      /// Enables compression on unicast communications.
      /// Compression capabilities are negotiated during session establishment.
      /// If both Zenoh nodes support compression, then compression is activated.
      compression: {
        enabled: false,
      },
    },
  },
},
```

Upon session establishment, Zenoh nodes performs a handshake to verify whether transparent compression should be activated or not. If both agree, then hop-to-hop compression is transparently used as illustrated in the figure below.

{{< figure-inline
    src="../../img/20240430-blog-zenoh-electrode/compression.png"
    class="figure-inline"
    alt="Zenoh transparent compression">}}

It’s worth highlighting that Zenoh applications don’t need to be modified to use this feature since, from their perspective, they will send and receive uncompressed data. All the compression happens under the hood, making it completely transparent.

# Plugins support in applications

Plugins have been available only on Zenoh routers, _i.e._, [zenohd](https://github.com/eclipse-zenoh/zenoh/tree/main/zenohd). Starting from the 0.11.0 release, plugins can be loaded and started by any application written in any supported language, e.g. Rust, C, C++, Python. To enable it it’s sufficient to pass the following configuration upon zenoh session open:

```json
{
  "plugins_loading": {
    // Enable plugins loading.
    "enabled": true
    /// Directories where plugins configured by name should be looked for. Plugins configured by __path__ are not subject to lookup.
    /// If enabled: true and search_dirs is not specified then search_dirs falls back to the default value: ".:~/.zenoh/lib:/opt/homebrew/lib:/usr/local/lib:/usr/lib"
    // search_dirs: [],
  },
  /// Plugins are only loaded if plugins_loading: { enabled: true } and present in the configuration when starting.
  /// Once loaded, they may react to changes in the configuration made through the zenoh instance's adminspace.
  "plugins": {
    "my_plugin": {
      // my_plugin specific configuration
    }
  }
}
```

More configuration details on plugins are available [here](https://github.com/eclipse-zenoh/zenoh/blob/9a9832a407300763af6e30652ac33bcaab2c94e4/DEFAULT_CONFIG.json5#L387).

# Verbatim chunks

A Zenoh key-expression is defined as a `/`-separated list of chunks, where each chunk is a non-empty UTF-8 string that can't contain the following characters: `*$?#`. E.g.: The key expression `home/kitchen/temp` is composed of 3 chunks: `home`, `kitchen`, and `temp`.

Wild chunks `*` and `**` then allow addressing multiple keys at once. For instance, the key expression `home/*/temp `addresses the `temp` for any value of the second chunk, such as bedroom, livingroom, etc.

This release introduces a new type of chunk: the verbatim chunk. The goal of these chunks is to allow some key spaces to be _hermetically sealed_ from each other. Any chunk that starts with `@` is treated as a verbatim chunk, and can only be matched by an identical chunk.

For instance, the key expression `my-api/@v1/** `does not intersect any of the following key expressions:

- `my-api/@v2/**`
- `my-api/*/**`
- `my-api/@$*/**`, and
- `my-api/**`

because the verbatim chunk `@v1` prohibits it.

In general, verbatim chunks are useful in ensuring that `*` and `** `accidentally match chunks that are not supposed to be matched. A common case is API versioning where `@v1` and `@v2` should not be mixed or at least explicitly selected. The full RFC on key expressions is available [here](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Key%20Expressions.md#verbatim-chunks-behavioural-breaking-change-in-zenoh-0110).

# Vsock links

Zenoh now offers support for Vsock connections, facilitating seamless communication between virtual machines and their host operating systems. [Vsock](https://man7.org/linux/man-pages/man7/vsock.7.html), or Virtual Socket, is a communication protocol designed for efficient communication between virtual machines and their host operating systems in virtualized environments. It enables high-performance communication with low latency and overhead.

Users can specify endpoints using both numeric and string-based addressing formats, allowing for flexible configuration. Numeric addresses such as` "vsock/-1:1234"` and string constant addresses like `"vsock/VMADDR_CID_ANY:VMADDR_PORT_ANY"` and `"vsock/VMADDR_CID_LOCAL:2345"` are supported. This enhancement expands Zenoh's communication capabilities within virtualized environments, fostering improved integration and interoperability.

# Connection timeouts and retries

Zenoh’s configuration has been improved to fine tune how Zenoh connects to configured remote endpoints and tries to open listening endpoints.

In both [connect](https://github.com/eclipse-zenoh/zenoh/blob/ac6bbf4676949677887e96e9bb38519cab69ad28/DEFAULT_CONFIG.json5#L24) and [listen](https://github.com/eclipse-zenoh/zenoh/blob/ac6bbf4676949677887e96e9bb38519cab69ad28/DEFAULT_CONFIG.json5#L57) sections of the configuration, the following entries have been added:

- `timeout_ms` defines the maximum amount of time (in milliseconds) Zenoh should spend trying (and eventually retrying) to connect to remote endpoints or to open listening endpoints before eventually failing. Special value `0` indicates no retry and special value `-1` indicates infinite time.
- `exit_on_failure` defines how Zenoh should behave when it fails to connect to remote endpoints or to open listening endpoints in the allocated `timeout_ms` time. `true` indicates that `open()` should return an error when the timeout elapsed. `false` indicates that `open()` should return `Ok` when the timeout elapsed and continue to try to connect to configured remote endpoints and to open configured listening endpoints in background.
- `retry` is a sub-section that defines the frequency of the Zenoh connection attempts and listening endpoints opening attempts.
  - `period_init_ms` defines the period in milliseconds between the first attempts.
  - `period_increase_factor` defines how much the period should increase after each attempt.
  - `period_max_ms` defines the maximum period in milliseconds between the first attempts whatever the increase factor.

For example, the following configuration:

```json
retry {
    period_init_ms: 1000,
    period_increase_factor: 4000,
    period_increase_factor: 2
}
```

will lead to the following periods between successive attempts (in milliseconds): 1000, 2000, 4000, 4000, 4000, ...

It is also possible to define different configurations for different endpoints by setting different values directly in the endpoints strings. Typically if you want your `peer` to imperatively connect to an endpoint (and fail if unable) and optionally connect to another, you can configure your `connect/endpoints` like this: `["tcp/192.168.0.1:7447#exit_on_failure=true", "tcp/192.168.0.2:7447#exit_on_failure=false"]`.

# Improved congestion control

Congestion control has been improved in this release and made both less aggressive and configurable. For the sake of understanding this change, it’s important to know that Zenoh uses an internal queue for transmission. Until now, messages published with `CongestionControl::Drop` were dropped as soon as the internal queue was full. However, this led to an aggressive dropping strategy since short bursts couldn’t be accommodated unless the size of the queue was increased, at the cost of additional memory consumption.

Now, messages are dropped not when the queue is full but when the queue has been full for at least a given amount of time. By default, messages are dropped if the queue is full for \_1ms. \_Congestion control timeout can be configured as follows:

```json
{
  "transport": {
    "link": {
      "tx": {
        /// Each zenoh link has a transmission queue that can be configured
        "queue": {
          /// Congestion occurs when the queue is empty (no available batch).
          /// Using CongestionControl::Block the caller is blocked until a batch is available and re-insterted into the queue.
          /// Using CongestionControl::Drop the message might be dropped, depending on conditions configured here.
          "congestion_control": {
            /// The maximum time in microseconds to wait for an available batch before dropping the message if still no batch is available.
            "wait_before_drop": 1000
          }
        }
      }
    }
  }
}
```

# Mutual TLS authentication in QUIC

Although Zenoh supported QUIC from the very beginning, a recently added feature is the support of mutual authentication with TLS (mTLS) also for QUIC.

mTLS allows to verify the identity of the server as well as the client, this means that only a client having the right certificate can access the Zenoh infrastructure.

Supporting mTLS in QUIC allows for new use-cases where mobility and security are key.

Configuration of mTLS in QUIC is done via the same parameters currently used for [mTLS configuration on TCP](https://zenoh.io/docs/manual/tls/#mutual-authentication-mtls), thus facilitating the migration (or adoption) for users currently using mTLS over TCP. It is sufficient to add a new locator with QUIC to start using mTLS over QUIC!

An example configuration of QUIC with mTLS is:

```json
{
  // ...
  // your usual zenoh configuration
  "connect": {
    "endpoints": ["quic/<ip address or dnsname>:<port>"]
  },
  "transport": {
    "link": {
      "tls": {
        "client_auth": true,
        "client_certificate": "/cert.pem",
        "client_private_key": "/cert-key.pem",
        "root_ca_certificate": "/root.pem"
      }
    }
  }
  // ...
}
```

# New features for Zenoh-Pico

In addition to addressing numerous bugs, the upcoming release of zenoh-pico 0.11 introduces several new features:

- Users can now easily integrate zenoh-pico as a library with Zephyr.
- We added support for serial connection timeouts for the espidf freertos platform.
- Zenoh-pico now runs on the Flipper Zero platform.
- Finally, this update brings metadata attachment functionality for publications (query and reply coming soon).

# Bugfixes

- Fix session mode overwriting in configuration file
- Fix reviving of dropped liveliness tokens
- Fix formatter reuse and `**` sometimes being considered as included into `*`
- Fix CLI argument parsing in examples
- Fix broken Debian package
- Fix partial storages replication
- Fix potential panic in z_sub_thr example
- Correctly enable unstable feature in zenoh-plugin-example
- Build plugins with default zenoh features
- Restore sequence number in case of frame drops caused by congestion control
- Align examples and remove reading from stdin
- Fix scouting on unixpipe transport
- Fix digest calculation errors in replication

And more. Checkout the [release changelog](https://github.com/eclipse-zenoh/zenoh/releases/tag/0.11.0-rc.1) to check all the new features and bug fixes with their associated PR’s!

---

# What’s next?

The big news is that in June 2024 we are going to release v1.0.0. This version, along with several innovations, will provide users and the community a first stable version for which we’ll guarantee API and protocol backward compatibility. This is an important milestone as more and more projects and products on the market rely on our beloved Blue Dragon Protocol ;-)

Happy Hacking,

– The Zenoh Team

P.S. You can reach us out on Zenoh’s [Discord server](https://discord.com/invite/vSDSpqnbkm)!

![Guitar](../../img/20231003-blog-zenoh-dragonite/zenoh-on-fire.gif)
