---
title: "Deployment"
weight : 2300
menu:
  docs:
    parent: getting_started
---

## Overview

Zenoh supports multiple communication models.

![topology animation](/img/deployment/topology_anim.gif "topology animation")

## Peer to peer

By default Zenoh applications are configured to communicate peer to peer (`peer` mode). All applications in the local network directly communicate with each other.

![peer to peer](/img/deployment/peer_to_peer.png "peer to peer")

**Configuration**
```
{
  mode: "peer",
}
```

### Scouting

Zenoh applications in `peer` mode run both `multicast` and `gossip` scouting to discover other applications or Zenoh routers and connect them.

**Multicast scouting**

Zenoh applications in `peer` mode join multicast group `224.0.0.224` on UDP port `7446` and send scout messages on this address to discover local applications and routers. They automatically connect to all accessible `peer` mode applications and routers they discover. The scouting address and behavior can be configured.

**Configuration**
```
{
  mode: "peer",
  scouting: {
    multicast: {
      enabled: true,
      address: "224.0.0.224:7446",
      interface: "auto",
      autoconnect: { router: [], peer: ["router", "peer"] }, 
      listen: true,
    },
  },
}
```

**Gossip scouting**

Zenoh applications in `peer` mode forward all local applications and routers that they already discovered to newly scouted applications. This is useful when multicast communications are not available. But applications need to connect first to an entry point to discover the rest of the system. This entry point is typically one or several Zenoh routers but can also be one or several other peers. Those entry points are configured through the `connect` section of the configuration.

**Configuration**
```
{
  mode: "peer",
  connect: {
    endpoints: ["tcp/192.168.1.1:7447", "tcp/192.168.1.2:7447"],
  },
  scouting: {
    gossip: {
      enabled: true,
      multihop: false,
      autoconnect: { router: [], peer: ["router", "peer"] }, 
    },
  },
}
```

## Brokered

Communicating peer to peer implies establishing multiple sessions with multiple other peers and maintaining a state for those sessions. Maintaining such states can be undesirable for scalability reasons or because the application runs on a constrained device. In this case the Zenoh application can be configured to operate in client mode. In this mode, the application will maintain, at any given time, a single session with another process (typically a Zenoh daemon: `zenohd`) that will grant it connectivity with the rest of the system.

![brokered](/img/deployment/brokered.png "brokered")

**Configuration**
```
{
  mode: "client",
}
```

### Scouting

Zenoh applications in `client` mode run `multicast` scouting to discover Zenoh nodes and connect to them. In addition, the endpoints of one or several nodes can be configured in the `connect` section.

**Configuration**
```
{
  mode: "client",
  connect: {
    endpoints: ["tcp/192.168.1.1:7447", "tcp/192.168.1.2:7447"],
  },
}
```

## Routed 

Zenoh applications deployed in router mode can route data on behalf of other applications of the subsystem. This allows deploying applications in a mesh topology.
By default, router nodes never try to connect to each other automatically and must be configured with the endpoints of the other router nodes they are supposed to connect to. 

![routed](/img/deployment/routed.png "routed" )

```
{
  mode: "router",
  connect: {
    endpoints: ["tcp/192.168.1.1:7447", "tcp/192.168.1.2:7447"],
  },
}
```

## Zenoh regions

A Zenoh system can be subdivided into regions. Each region can operate with a different communication model (Peer-to-Peer, Brokered or Routed).

### The Zenoh Gateway

A Zenoh gateway is a Zenoh node that can serve one or several subregions called *south* regions. It will act as a representative of the south region(s) in the main region called the *north* region.

The `mode` of the Zenoh gateway node defines what communication model is used in the north region and thus how the node should act in the north region. A Zenoh gateway can accept any communication model in each of its south regions. Thus configuration of south regions' modes is not necessary.

![gateay](/img/deployment/gateway.png "gateway")

Each region will use one of the three currently available communication patterns:

**Routed:**
In routed regions, Zenoh nodes must be deployed with `router` mode and can be deployed in a mesh topology.

![routed](/img/deployment/routed_region.png "routed")

**Peer to Peer:**
In peer to peer regions, Zenoh nodes must be deployed with `peer` mode and must also be deployed in a clique topology where every node is connected to all other nodes of the region.

![peer2peer](/img/deployment/peer2peer_region.png "peer2peer")

**Brokered:**
In brokered regions, Zenoh nodes must be deployed with `client` mode and must also be connected to a "broker" node. The broker node is typically a gateway to a north region or the super node of the system. The mode of the broker node is irrelevant for the brokered region and only affects the north region.

![brokered](/img/deployment/brokered_region.png "brokered")

#### Scalability considerations

The gateway will hide non needed details of the sub region(s) to the upper region (number of nodes, topology, individual subscribers and queryables, etc..). It will also hide non needed details of the upper region to the sub regions. This provides more scalability to Zenoh systems.

### Limitations

#### Regions hierarchy

While different topologies and communication models are possible inside each Zenoh region, the Zenoh regions **must** be deployed in a **hierarchical** manner. A Zenoh region can have at most one north region. 
Note: for load balancing and fault tolerance purposes, multiple gateways may be deployed to serve a same south region in a north region, but those multiple gateways **must** be deployed in the same north region.

![hierarchy](/img/deployment/hierarchy.png "hierarchy")

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

Nodes that do not match any south region and don't have the correct mode for the north region will be rejected and will fail to connect.

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







