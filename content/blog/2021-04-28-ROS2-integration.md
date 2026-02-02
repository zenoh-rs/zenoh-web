---
title: "Integrating ROS2 with Eclipse zenoh"
date: 2021-04-28
menu: "blog"
weight: 20210428
description: "28 April 2021 -- Paris."
draft: false
---

In our [previous blog](./2021-03-23-discovery/) we demonstrated how the [zenoh bridge for DDS](https://github.com/eclipse-zenoh/zenoh-plugin-dds) allows to (1) bridge DDS communications through zenoh, and (2) reduce by up to 99.97% the discovery traffic between the nodes.

The previous blog was focusing on demonstrating the advantages of using zenoh as the mean for ROS2-to-ROS2 communication over wireless technologies. In this blog, we’ll go one step further and will demonstrate how you can easily write native zenoh applications —meaning that has no dependencies on ROS2 — and seamlessly interact with [ROS2](https://docs.ros.org/en/foxy/index.html) applications. Finally, we will show how you can extend your communication to Internet scale, allowing to cover all the typical cases for Robot-to-anything (R2X) communication.

-------
## What does the zenoh/DDS bridge do ?

The zenoh/DDS bridge is leveraging [CycloneDDS](https://github.com/eclipse-cyclonedds/cyclonedds) to discover the DDS readers and writers declared by the ROS2 application. For each discovered DDS entity the bridge creates a mirror DDS-entity — in other terms it creates a reader when discovering a writer and vice-versa. Additionally, the bridge maps the DDS topics read and written by the discovered DDS entities on zenoh resources and performs the proper declarations.

As example, let’s consider the [turtlesim](http://docs.ros.org/en/foxy/Tutorials/Turtlesim/Introducing-Turtlesim.html) package used in the ROS2 Tutorial:  
- By default the turtlesim node has a ROS2 Publisher on topic `/rosout`. As per [ROS2 conventions](https://design.ros2.org/articles/topic_and_service_names.html#ros-specific-namespace-prefix) this maps to a DDS Writer on topic `rt/rosout`. Consequently, the zenoh/DDS bridge declares a DDS Reader on the same topic with matching QoS. This DDS Reader will receive all publications from the turtlesim on this topic and re-publish those on a zenoh resource having `/rt/rosout` as a key.
- The turtlesim also has a ROS2 Subscriber on topic `/turtle1/cmd_vel` that maps as a DDS Reader on `rt/turtle1/cmd_vel`. The zenoh/DDS bridge declares a DDS Writer on the same topic, and a zenoh subscriber for the key `/rt/turtle1/cmd_vel`. This zenoh subscriber will receive all publications with this key from any zenoh application and re-publish those to DDS on topic `rt/turtle1/cmd_vel` to be received by the ROS2 subscriber on `/turtle1/cmd_vel`.

-------
## How to encode/decode ROS2 messages ?

You may have noticed that the zenoh/DDS bridge doesn’t need to be compiled with any ROS2 message definition. That is because the bridge doesn’t need to interpret the ROS2 messages. It just forwards the data payload as is. As a consequence a zenoh application that needs to publish/subscribe to ROS2 will need to encode/decode those messages.

For those who are curious about the details, the ROS2 messages are encoded for DDS following the [OMG DDSI-RTPS specification (see §10)]() in [CDR format (see §9.3)](https://www.omg.org/spec/CORBA/3.4/Interoperability/PDF). But fortunately, you usually don't need to implement a CDR encoder/decoder, since there are libraries for this in most languages 
([Python](https://pypi.org/project/pycdr/), [Rust](https://crates.io/crates/cdr), [C#](https://www.nuget.org/packages/CSCDR), [Javascript](https://www.npmjs.com/package/jscdr)...)

-------
## Show me some code

OK, let's do a zenoh "teleop" app in Python for a start. It will publish Twist messages to the turtlesim's `/turtle1/cmd_vel` Subscriber and subscribe to Log messages published by the turtlesim's `/rosout` Publisher.

All that you need is:
 - A host with ROS2 environment and:
    - the [turtlesim](http://docs.ros.org/en/foxy/Tutorials/Turtlesim/Introducing-Turtlesim.html) package
    - the [zenoh/DDS bridge](https://github.com/eclipse-zenoh/zenoh-plugin-dds/#trying-it-out)
 - Another host in the same LAN with (or you can use the same host, but that's less fun...):
    - the [zenoh Python API](https://github.com/eclipse-zenoh/zenoh-python#how-to-install-it) and pycdr installed -  
      just do: `pip install eclipse-zenoh pycdr`

_**Note**: currently you need to build the zenoh/DDS bridge yourself. But we will provide pre-built binaries for main platforms soon. Once built, the `zenoh-bridge-dds` executable is generated in the `zenoh-plugin-dds/target/release` subdirectory._


Now:
 1. **Start the turtlesim** on host 1:
    ```shell
    ros2 run turtlesim turtlesim_node
    ```

 2. **Start the zenoh/DDS bridge** on host 1:
    ```shell
    RUST_LOG=info zenoh-bridge-dds -m peer
    ```
    The `RUST_LOG=info` environment variable is to activate the logs at "info" level. You should see such logs proving that the bridge discovered the turtlesim's Publishers and Subscribers:
    ```shell
    [2021-04-13T13:11:58Z INFO  zenoh_bridge_dds] New route:
       DDS 'rt/rosout' => zenoh '/rt/rosout' (rid=19) with type'rcl_interfaces::msg::dds_::Log_'
    [2021-04-13T13:11:58Z INFO  zenoh_bridge_dds] New route:
       zenoh '/rt/turtle1/cmd_vel' => DDS 'rt/turtle1/cmd_vel' with type'geometry_msgs::msg::dds_::Twist_'
    ```

 3. On host 2, run the following **Python** script:
    ```python
    # Some required imports
    import zenoh
    from pycdr import cdr
    from pycdr.types import int8, int32, uint32, float64

    # Declare the types of Twist message to be encoded and published via zenoh
    @cdr
    class Vector3:
       x: float64
       y: float64
       z: float64

    @cdr
    class Twist:
       linear: Vector3
       angular: Vector3

    # Declare the types of Log message to be decoded and subscribed to via zenoh
    @cdr
    class Time:
       sec: int32
       nanosec: uint32

    @cdr
    class Log:
       stamp: Time
       level: int8
       name: str
       msg: str
       file: str
       function: str
       line: uint32

    # Initiate the zenoh-net API
    session = zenoh.open()

    # Declare the callback and the subscriber for Log messages with key 'rt/rosout'
    def rosout_callback(sample):
        log = Log.deserialize(sample.payload)
        print('[{}.{}] [{}]: {}'.format(
            log.stamp.sec, log.stamp.nanosec, log.name, log.msg))

    sub = session.declare_subscriber('rt/rosout', rosout_callback, reliability=zenoh.Reliability.RELIABLE())

    # Publish a Twist message with key 'rt/turtle1/cmd_vel' to make the turtlesim to move forward
    t = Twist(linear=Vector3(x=2.0, y=0.0, z=0.0),
              angular=Vector3(x=0.0, y=0.0, z=0.0)).serialize()
    session.put('rt/turtle1/cmd_vel', t)

    # Make it move forward until it hits the wall!!
    session.put('rt/turtle1/cmd_vel', t)
    session.put('rt/turtle1/cmd_vel', t)
    ```

You can see more complete versions of a "teleop" code with various options and arrows key-pressed listener here:
  - in Python: https://github.com/eclipse-zenoh/zenoh-demos/tree/main/ROS2/zenoh-python-teleop
  - in Rust: https://github.com/eclipse-zenoh/zenoh-demos/tree/main/ROS2/zenoh-rust-teleop

-------
## How do I use zenoh to operate my robot from anywhere in the world ?

In the scenario described above, the zenoh application discovers the zenoh/DDS bridge via its scouting protocol that leverages UDP multicast - when available. Once discovered, a TCP connection is established between the app and the bridge

![multicast discovery](../../img/blog-RO2-integration/multicast-discovery.png)


But the zenoh application can also be configured to directly establish a TCP connection with a known host, without relying on scouting protocol. Thus, it can connect directly to the bridge (if reachable) or to 1 or more zenoh routers that will route the zenoh communications between the application and the bridge.

Let's see the different use cases:

### 1. Opening a TCP port and redirecting it to the zenoh/DDS bridge

Assuming you can configure your internet connection to open a public TCP port (e.g. 7447) and redirect it to the host running the zenoh/DDS bridge, you can do the following deployment:

![open port](../../img/blog-RO2-integration/open-port.png)


Where:
  - the zenoh/DDS bridge is started with this command:
    ```shell
    zenoh-bridge-dds -m peer -l tcp/0.0.0.0:7447
    ```
    The `-l` option makes the bridge to listen for TCP connection on port 7447.

  - Our zenoh teleop application must be configured to connect to the public IP and port of the bridge.  
    In Python, this is done adding a `"peer"` configuration when initializing the API:
    ```python
    # note: replace "123.4.5.6" with your public IP in here:
    session = zenoh.net.open({"peer": "tcp/123.4.5.6:7447"})
    ```
    With the "teleop" demos provided [here](https://github.com/atolab/zenoh-demo/tree/main/ROS2), you can use the `-e tcp/123.4.5.6:7447` program argument.

### 2. Behind a NAT? Leverage a zenoh router in the cloud!

If you can't open a public TCP port in your LAN, let's use a zenoh router in a public cloud instance that will intermediate the communications between the bridge and the zenoh application:

![router in cloud](../../img/blog-RO2-integration/router-in-cloud.png)


To deploy this:

 1. Pick your favorite cloud provider and provision a 64-bit Ubuntu VM with a public IP.

 2. Install the zenoh router in this VM following those instructions:
    http://zenoh.io/docs/getting-started/installation/#ubuntu-or-any-debian-x86-64

 3. Run the zenoh router in your vm staring:
    ```shell
    zenohd
    ```
    Now the zenoh router is reachable on via the public IP of your VM on port **7447** by default.

 4. Run the zenoh/DDS bridge as a router client, making it to connect the zenoh router:
    ```shell
    # note: replace "123.4.5.6" with your cloud VM's public IP in here:
    zenoh-bridge-dds -m client -e tcp/123.4.5.6:7447
    ```

 5. our zenoh teleop application must be also configured as a router client to connect the zenoh router:
    ```python
    # note: replace "123.4.5.6" with your cloud VM's public IP in here:
    session = zenoh.net.open({"mode": "client" , "peer": "tcp/123.4.5.6:7447"})
    ```
    With the "teleop" demos provided [here](https://github.com/atolab/zenoh-demo/tree/main/ROS2), you can use the `-m client -e tcp/123.4.5.6:7447` program arguments.

### 3. What if my cloud instance crashes or reboot ?

Just deploy several interconnected zenoh routers in different cloud instances:

![cloud crash](../../img/blog-RO2-integration/cloud-crash-2.gif)


 1. Run a first zenoh router in 1st cloud:
    ```shell
    zenohd
    ```
 2. Run another zenoh router in 2nd cloud, connected to zenoh router in 1st cloud:
    ```shell
    zenohd -e tcp/123.4.5.6:7447
    ```
 3. Run the zenoh/DDS bridge as a router client, configured with the 2 zenoh routers' locators:
     ```shell
    # note: replace "123.4.5.6" and "123.7.8.9" with your cloud VMs' public IPs in here:
    zenoh-bridge-dds -m client -e tcp/123.4.5.6:7447 -e tcp/123.7.8.9:7447
    ```
 4. our zenoh teleop application must be also configured as a router client and with the 2 zenoh routers' locators:
    ```python
    # note: replace "123.4.5.6" and "123.7.8.9" with your cloud VMs' public IPs in here:
    session = zenoh.net.open({"mode": "client" , "peer": "tcp/123.4.5.6:7447,tcp/123.7.8.9:7447"})
    ```
    With the "teleop" demos provided [here](https://github.com/atolab/zenoh-demo/tree/main/ROS2), you can use the `-m client -e tcp/123.4.5.6:7447 -e tcp/123.7.8.9:7447` program arguments.

Now, both bridge and zenoh application will connect to the 1st configured locator (i.e. router in 1st cloud). If this one fails, they will both failover to the router in 2nd cloud.

### 4. Other deployments (e.g. mesh network)

Notice that in the previous use case, as the 2 zenoh routers are interconnected, the zenoh/DDS bridge and the zenoh application don't need to be connected to the same router to communicate with each other. If they are connected to distinct routers, they will route the zenoh traffic between them, and the bridge and the application will still communicate with each other.

Actually, you can deploy the zenoh/DDS bridge, your teleop application and one or more interconnected zenoh router in all the ways described in the [zenoh documentation](./../docs/getting-started/key-concepts/#deployment-units). Just use the `-m peer` or `-m client` argument for the `zenoh-bridge-dds` to configure it as a peer or a client. And similarly for your zenoh teleop application.

-------
## One more thing...

Did I mention that you can easily communicate with more than 1 robot using Eclipse zenoh? Let's make several independent turtlesims move in a synchronous way!

Start as many turtlesim you want, each using its own ROS domain[^1]:
```shell
ROS_DOMAIN_ID=1 ros2 run turtlesim turtlesim_node
ROS_DOMAIN_ID=2 ros2 run turtlesim turtlesim_node
ROS_DOMAIN_ID=3 ros2 run turtlesim turtlesim_node
...
```

For each turtlesim, run a zenoh/DDS bridge using the same ROS domain (via `-d` argument) and specifying a prefix that will be added to each zenoh key (via `-s` argument):
```shell
zenoh-bridge-dds -d 1 -m peer -s /bot-1
zenoh-bridge-dds -d 2 -m peer -s /bot-2
zenoh-bridge-dds -d 3 -m peer -s /bot-3
...
```
Now for turtlesim on domain 1, the `/rosout` and `/turtle1/cmd_vel` ROS2 topics are mapped respectively to `/bot-1/rt/rosout` and `/bot-1/rt/turtle1/cmd_vel` zenoh keys. And similarly but with a different prefix for each turtlesim.

The zenoh trick to rule them all is to just subscribe and publish via [path expressions](http://zenoh.io/docs/manual/abstractions/#key-expressions). In the Python code shown above:
 - subscribe to `'/**/rosout'` instead of `'/rt/rosout'`
 - publish Twist messages to `'/**/cmd_vel'` instead of `'/rt/turtle1/cmd_vel'`

You can also test this with the "teleop" demos provided [here](https://github.com/atolab/zenoh-demo/tree/main/ROS2), using the `--rosout='/**/rosout' --cmd_vel='/**/cmd_vel'` program arguments.

[**--JE**](https://github.com/JEnoch)

[^1]: **Why 1 domain per robot ?**  
In most of the cases, you don't need the robots to communicate with each other. But if you let them use the same `ROS_DOMAIN_ID`, their DDS entities in the robots will anyway exchange discovery information with each other leading to a lot of unnecessary traffic that could be problematic over wireless communications (as seen in our previous blog). The simplest way to avoid such traffic is to use distinct domains. Other solutions could be specific network configuration, or specific DDS configuration.

