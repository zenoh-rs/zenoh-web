---
title: "Regions"
weight : 7100
menu:
  docs:
    parent: migration_1.9
---

## Zenoh regions

Zenoh version 1.9.0 introduces a new feature that allows subdividing a system into _regions_ in a more flexible manner than before. This provides more scalability and allows deployments and topologies that were not possible before.

### The Zenoh Gateway

Version 1.9.0 introduces the Zenoh *Gateway*. A Zenoh gateway is a Zenoh node that can serve one or several subregions called *south* regions. It will act as a representative of the south region(s) in the main region called the *north* region.

The `mode` of the Zenoh gateway node defines what communication model is used in the north region and thus how the node should act in the north region. A Zenoh gateway can accept any communication model in each of its south regions. Thus configuration of south regions' modes is not necessary.

![gateay](/img/migration_1.9/gateway.png "gateway")

Each region will use one of the three currently available communication patterns:

**Routed:**
In routed regions, Zenoh nodes must be deployed with `router` mode and can be deployed in a mesh topology.

![routed](/img/migration_1.9/routed.png "routed")

**Peer to Peer:**
In peer to peer regions, Zenoh nodes must be deployed with `peer` mode and must also be deployed in a clique topology where every node is connected to all other nodes of the region.

![peer2peer](/img/migration_1.9/peer2peer.png "peer2peer")

**Brokered:**
In brokered regions, Zenoh nodes must be deployed with `client` mode and must also be connected to a "broker" node. The broker node is typically a gateway to a north region or the super node of the system. The mode of the broker node is irrelevant for the brokered region and only affects the north region.

![brokered](/img/migration_1.9/brokered.png "brokered")

#### Scalability considerations

The gateway will hide non needed details of the sub region(s) to the upper region (number of nodes, topology, individual subscribers and queryables, etc..). It will also hide non needed details of the upper region to the sub regions. This provides more scalability to Zenoh systems.

### Limitations

#### Regions hierarchy

While different topologies and communication models are possible inside each Zenoh region, the Zenoh regions **must** be deployed in a **hierarchical** manner. A Zenoh region can have at most one north region. 
Note: for load balancing and fault tolerance purposes, multiple gateways may be deployed to serve a same south region in a north region, but those multiple gateways **must** be deployed in the same north region.

![hierarchy](/img/migration_1.9/hierarchy.png "hierarchy")

#### Routed regions

Routed regions (regions in which Zenoh nodes are deployed with the `router` mode and in which Zenoh nodes can be deployed in a mesh topology) can only be deployed in the south of other routed regions. 
Routed regions **cannot** be deployed in the south of a peer-to-peer region or in the south of a brokered region.

### Configuration

Zenoh gateways are configured by specifying through filters which connected nodes should go to the north region and which connected nodes should go to the south regions (and which south region). The connected nodes can be filtered by modes, zids, network interface and/or region names. 

This configuration is located in the `gateway/south` section of the Zenoh configuration. The default value of this section is: `"auto"`. When set to `"auto"`, Zenoh will filter nodes according to their mode in the most natural manner and similarly to previous versions. Routers will always go to the north while non gateway clients will go to the south.

Example:
```
{
  gateway: {
    south: "auto",
  }
}
```

For more advanced gateways configurations, the `gateway/south` section should contain a list of south regions. Each region should containing a list of filters. All nodes matching one of the filters will be affected to the corresponding south region.

Each filter can contain a list of conditions: `modes`, `zids`, `interfaces` and/or `region_names`. Each condition is a list of possible values. A filter can also have an optional `negate` boolean. 
- A node matches a condition, if it matches one of the possible values. 
- A node matches a filter if 
    - it matches all the conditions of the filter. 
    - or if `negate` is `true` and the node deos not match one of the conditions of the filter.
- A node matches a south region if it matches one of the filters of the region. 

Example of configuration with two south regions:
```
{
  gateway: {
    south: [
      {
        filters: [
          {
            modes: ["peer", "client"],
            zids: ["aa", "bb", "cc"]
          }
        ]
      },
      {
        filters: [
          {
            interfaces: ["wlan0"],
            negate: true
          }
        ]
      }
    ]
  }
}
```

Nodes that do not match any south region and has the correct mode for the north region will be affected to the north region.

Nodes that do not match any south region and don't have the correct mode for the north region will be affected to the *unbound* region. The  *unbound* region behaves like a south region.

#### Region names

A region name can be assigned to Zenoh nodes.

Example:
```
{
  region_name: "region1"
}
```

Nodes can be filtered by their region name in the `gateway` configuration.

Examples:
```
{
  gateway: {
    south: [
      {
        filters: [
          {
            region_names: ["region1"],
          }
        ]
      }
    ]
  }
}
```

```
{
  gateway: {
    south: [
      {
        filters: [
          {
            negate: true,
            region_names: ["main"],
          }
        ]
      }
    ]
  }
}
```

### New possible topologies

Here are examples of topologies that were not possible to deploy before and are now available.

#### South regions interconnected as clients

![topology1](/img/migration_1.9/new_topo1.png "topology1")

Example of configuragtion for nodes `A` and `B`:
```
{
  mode: "client",
  listen: {
    endpoints: ["tcp/[::]:0"]
  },
  connect: {
    endpoints: ["tcp/router_ip:7447"]
  },
  gateway: {
    south: [
      {
        filters: [
          {
            modes: ["client", "peer"]
          }
        ]
      }
    ]
  }
}
```

Example of configuragtion for nodes `C`, `D`, `E` and `F`:
```
{
  mode: "peer"
}
```


#### South regions interconnected in peer to peer

![topology2](/img/migration_1.9/new_topo2.png "topology2")

Example of configuragtion for nodes `A` and `B`:
```
{
  mode: "peer",
  region_name: "main",
  gateway: {
    south: [
      {
        filters: [
          {
            negated: true,
            region_names: ["main"]
          }
        ]
      }
    ]
  }
}
```

Example of configuragtion for nodes `C`, `D`, `E` and `F`:
```
{
  mode: "peer"
}
```



## Migration

Most scenarios and topologies will continue working without any change when migrating from Zenoh version 1.8.x to 1.9.0. But:
- Some configuration option defaults have been changed.
- Some features and configuration options have been removed or changed in Zenoh v1.9.0.

### Changed defaults

| Option | Previous default | New default |
|--------|------------------|-------------|
| `connect.timeout_ms` | `{ router: -1, peer: -1, client: 0 }` | `-1` |
| `connect.exit_on_failure` | `{ router: false, peer: false, client: true }` | `false` |
| `scouting.timeout` | `3000` | `-1` |
| `scouting.multicast.listen` | `{ router: true, peer: true, client: false }` | `true` |
| `scouting.multicast.autoconnect` | `{ router: [], peer: ["router", "peer"], client: ["router"] }` | `{ router: [], peer: ["router", "peer", "client"], client: ["router", "peer", "client"] }` |
| `scouting.gossip.autoconnect` | `{ router: [], peer: ["router", "peer"], client: ["router"] }` | `{ router: [], peer: ["router", "peer", "client"], client: ["router", "peer", "client"] }` |

### Removed options

Here is a list of configuration options that have been removed in Zenoh v1.9.0 and instructions on how to change the Zenoh configuration to deploy similar scenarios with Zenoh v1.9.0. 

#### `peers_failover_brokering` option

The peer failover brokering feature in routers has been removed and the corresponding option `routing/router/peers_failover_brokering` is no longer available in the configuration. This feature allowed the following kind of topology:

![topology1](/img/migration_1.9/migration_topo1.png "topology1")

This kind of deployment will not work any more out of the box.

Here are 2 ways to workaround this change:

**Deploy one gateway per subregion**

Examples:

![topology2](/img/migration_1.9/migration_topo2.png "topology2")
![topology3](/img/migration_1.9/migration_topo3.png "topology3")

**Configure multiple south regions on the gateway**

If you really need a single gateway to serve two or more subregions of peers, you can configure multiple south regions on the gateway.

Example using region names:

![topology4](/img/migration_1.9/migration_topo4.png "topology4")

On gateway `A`:
```
{
  gateway: {
    south: [
      {
        filters: [
          {
            region_names: ["region_1"]
          }
        ]
      },
      {
        filters: [
          {
            region_names: ["region_2"]
          }
        ]
      }
    ]
  }
}
```

On peers `B` and `C`:
```
{
  region_name: "region_1"
}
```

On peers `D` and `E`:
```
{
  region_name: "region_2"
}
```

#### `routing/peer` options

The `routing/peer` section of Zenoh configuration has been removed. Zenoh peers can now only operate peer-to-peer in a clique topology. The `router` mode should now be used to deploy subsystems of applications in a mesh topology. 

For example, the following deployment is now no longer possible as is:

![topology5](/img/migration_1.9/migration_topo5.png "topology5")

Such a scenario should be achieved by deploying all nodes in `router` mode and by configuring the `gateway` section of the 2 nodes of the upper layer that serve the subsystems:

![topology6](/img/migration_1.9/migration_topo6.png "topology6")

Example of configuration using region names:

On gateway `A`:
```
{
  mode: "router",
  gateway: {
    south: [
      {
        filters: [
          {
            region_names: ["region_1"]
          }
        ]
      }
    ]
  }
}
```

On gateway `B`:
```
{
  mode: "router",
  gateway: {
    south: [
      {
        filters: [
          {
            region_names: ["region_2"]
          }
        ]
      }
    ]
  }
}
```

On nodes `C` and `D`:
```
{
  mode: "router",
  region_name: "region_1"
}
```

On nodes `E` and `F`:
```
{
  mode: "router",
  region_name: "region_2"
}
```