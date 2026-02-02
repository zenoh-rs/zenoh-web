---
title: "Migrating from Zenoh v0.5.x to Zenoh v0.6.x"
weight : 5200
menu:
  docs:
    parent: migration_0.5_to_0.6
---

## Key expressions

Some key expressions are now considered invalid: 
- Heading slashes are forbidden. Example: `"/key/expression"`.
- Trailing slashes are forbidden. Example: `"key/expression/"`.
- Empty chunks are forbidden. Example: `"key//expression"`.

An error will be returned when trying to use such invalid key expressions.

## APIs

In zenoh version 0.6.0, zenoh and zenoh-net APIs have been merged into a single API.

## Configuration

In v0.5.x the Zenoh configuration was a list of key/value pairs.
In v0.6.x the has a structured format which can be expressed in JSON, JSON5 or YAML.

zenoh configuration has moved from a list of key value pairs to a more structured configuration that can be expressed as JSON5.

*Here was the configuration used by default by the zenoh router v0.5.x:*
```
mode=peer
peer=
listener=
user=
password=
multicast_scouting=true
multicast_interface=auto
multicast_ipv4_address=224.0.0.224:7447
scouting_timeout=3.0
scouting_delay=0.2
add_timestamp=false
link_state=true
user_password_dictionary=
peers_autoconnect=true
tls_server_certificate=
tls_root_ca_certificate=
shm=true
routers_autoconnect_multicast=false
routers_autoconnect_gossip=false
local_routing=true
join_subscriptions=
join_publications=
link_lease=10000
link_keep_alive=2500
seq_num_resolution=268435456
open_timeout=10000
open_pending=1024
peer_id=
batch_size=65535
max_sessions=1024
max_links=4
version=
qos=true
join_interval=2500
defrag_buff_size=1073741824
link_rx_buff_size=16777216
multicast_ipv6_address=[ff24::224]:7447
```

*Here is the new configuration (JSON5 format) used by default by the zenoh router v0.6.x:*
```json5
{
  id: null,
  mode: "router",
  connect: {
    endpoints: []
  },
  listen: {
    endpoints: [
      "tcp/0.0.0.0:7447"
    ]
  },
  scouting: {
    timeout: null,
    delay: null,
    multicast: {
      enabled: true,
      address: null,
      interface: null,
      autoconnect: null,
      listen: null
    },
    gossip: {
      enabled: null,
      autoconnect: null
    }
  },
  timestamping: {
    enabled: null,
    drop_future_timestamp: null
  },
  queries_default_timeout: null,
  routing: {
    peer: {
      mode: null
    }
  },
  aggregation: {
    subscribers: [],
    publishers: []
  },
  transport: {
    unicast: {
      accept_timeout: 10000,
      accept_pending: 100,
      max_sessions: 1000,
      max_links: 1
    },
    multicast: {
      join_interval: 2500,
      max_sessions: 1000
    },
    qos: {
      enabled: true
    },
    link: {
      tx: {
        sequence_number_resolution: 268435456,
        lease: 10000,
        keep_alive: 4,
        batch_size: 65535,
        queue: {
          size: {
            control: 1,
            real_time: 1,
            interactive_high: 1,
            interactive_low: 1,
            data_high: 2,
            data: 4,
            data_low: 4,
            background: 4
          },
          backoff: 100
        },
        threads: 2
      },
      rx: {
        buffer_size: 65535,
        max_message_size: 1073741824
      },
      tls: {
        root_ca_certificate: null,
        server_private_key: null,
        server_certificate: null,
        client_auth: null,
        client_private_key: null,
        client_certificate: null
      }
    },
    shared_memory: {
      enabled: true
    },
    auth: {
      usrpwd: {
        user: null,
        password: null,
        dictionary_file: null
      },
      pubkey: {
        public_key_pem: null,
        private_key_pem: null,
        public_key_file: null,
        private_key_file: null,
        key_size: null,
        known_keys_file: null
      }
    }
  },
  adminspace: {
    permissions: {
      read: true,
      write: false,
    },
  },
  plugins_search_dirs: [],
  plugins: {
    rest: {
      http_port: "8000"
    }
  }
}
```

For more details on the configuration file, see https://github.com/eclipse-zenoh/zenoh/blob/0.6.0-beta.1/DEFAULT_CONFIG.json5

### Admin space

In zenoh version 0.5.0 the admin space was returning router information on `@/router/<router_id>`, but was mainly used for management of Backends and Storages with put/delete/get on `@/router/<router_id>/plugin/storages/backend/<backend_id>` for Backends and `@/router/<router_id>/plugin/storages/backend/<backend_id>/storage/<storage_id>` for Storages.

In zenoh version 0.6.0 the admin space is split in 3 parts:
 - `@/router/<router_id>` : **read-only** key returning the status of the router itself
 - `@/router/<router_id>/config/**` : **write-only** subset of keys to change the configuration. The keys under this prefix exactly map the configuration file structure. Not all configuration keys can be changed, but the storages plugin configuration can in order to add/remove Backends and Storages (see below).
 - `@/router/<router_id>/status/plugins/**` : **read-only** subset of keys to retrieve the status of plugins (and Backends and Storages)

In zenoh version 0.5.0, the admin space was writeable by default. In v0.6.0 it's read-only by default.
Read/Write permission on its admin space can be now configured for a Zenoh router in 2 ways:
 - via the configuration file in the `adminspace.permissions` section
 - via the `zenohd` command line option: `--adminspace-permissions <[r|w|rw|none]>`

### Plugins configurations

In zenoh version 0.5.0 the plugins were automatically loaded by `zenohd` at startup when it detected their libraries on disk (`libzplugin_*.so` files).  
In zenoh version 0.6.0 a plugin is loaded at startup only if there is a configuration defined for it (in the `plugins` JSON5 struct).  
Note that in the default configuration the REST plugin is configured with `port: 8000`, meaning that this plugin is automatically loaded at startup. To not load is, set a configuration file without the `rest` configuration.

A plugin can also be dynamically configured and loaded at runtime, publishing its configurartion in the zenoh router's admin space. For instance, to make a router to load the webserver plugin, you can publish to the REST API:
`curl -X PUT -H 'content-type:application/json' -d '{http_port: "8080"}' http://localhost:8000/@/router/local/config/plugins/webserver`


### Backends/Storages configurations

Zenoh 0.5.0 was not making the distinction between the Backend library, and an instantiation of this library. Thus, it was not possible for instance to configure for the same router twice the InfluxDB backend but with different URL to distinct InfluxDB servers.
Zenoh 0.6.0 introduces the concept of Volume as an instance of a Backend library.
To summarize:
 - a **Backend** is a dynamic library (.so file) implementing Zenoh storages with the help of a specific technology (e.g. InfluxDB, RocksDB or the local file system)
 - a **Volume** is an instance of a Backend with a specific configuration (e.g. an instance of the InfluxDB backend with configured URL and credentials to for an InfluxDB server)
 - a **Storage** is attached to a Volume and configured with the specification of a sub-space in this Volume (e.g. a database name, a directory on filesystem...). It's also configured with the Zenoh key expression it must subscribes to (and replies to queries).

Starting from zenoh 0.6.0, the Backends and Storages are configurable for startup via the router configuration file, configuring the `storage_manager` plugin. Here is an examples of configuration file with several Backends/Storages:
```json5
{
  plugins: {
    // configuration of "storage_manager" plugin:
    storage_manager: {
      backends: {
        volumes: {
          // configuration of a "influxdb" volume using the "zbackend_influxdb"
          influxdb: {
            // URL to the InfluxDB service
            url: "http://localhost:8086",
          },
          // configuration of a 2nd volume using the "zbackend_influxdb" but using a different URL
          influxdb2: {
            backend: "influxdb",
            // URL to the InfluxDB service
            url: "http://192.168.1.2:8086",
          },
          // configuration of a "fs" volume using the "zbackend_fs" library (fs = file system)
          fs: {},
        },
        storages: {
          // configuration of a "storage1" storage using the "influxdb" volume
          storage1: {
            // the key expression this storage will subscribes to
            key_expr: "demo/storage1/**",
            // this prefix will be stripped from the received key when converting to database key.
            // i.e.: "demo/storage1/a/b" will be stored as "a/b"
            // this option is optional
            strip_prefix: "demo/storage1",
            volume: {
              id: "influxdb",
              // the database name within InfluxDB
              db: "zenoh_example",
              // if the database doesn't exist, create it
              create_db: true,
            }
          },
          // configuration of a "storage1" storage using the "influxdb2" volume
          storage2: {
            // the key expression this storage will subscribes to
            key_expr: "demo/storage2/**",
            strip_prefix: "demo/storage2",
            volume: {
              id: "influxdb2",
              // the database name within InfluxDB
              db: "zenoh_example",
              // if the database doesn't exist, create it
              create_db: true,
            }
          },
          // configuration of a "demo" storage using the "fs" volume
          fs_storage: {
            // the key expression this storage will subscribes to
            key_expr: "demo/example/**",
            strip_prefix: "demo/example",
            volume: {
              id: "fs",
              // the key/values will be stored as files within this directory (relative to ${ZBACKEND_FS_ROOT})
              dir: "example"
            }
          },
          // configuration of a "demo" storage using the "memory" volume (which is always present by default)
          in_memory: {
            key_expr: "demo/example/**",
            volume: {
              id: "memory"
            }
          }
        }
      }
    }
  }
}
```

Providing that the Zenoh router is configured with write permission on its admin space, the Volumes and Storages can be dynamically added/removed
at runtime via PUT/GET on the admin space, updating the storage_manager plugin config under `@/router/<router_id>/config/plugins/storage_manager`.
Examples:
 - to add a memory Storage:
   ```bash
   curl -X PUT -H 'content-type:application/json' -d '{key_expr:"demo/example/**",volume:{id:"memory"}}' http://localhost:8000/@/router/local/config/plugins/storage_manager/storages/demo
   ```
 - to add an InfluxDB Volume:
   ```bash
   curl -X PUT -H 'content-type:application/json' -d '{url:"http://localhost:8086"}' http://localhost:8000/@/router/local/config/plugins/storage_manager/volumes/influxdb
   ```
 - to add an InfluxDB Storage:
   ```bash
   curl -X PUT -H 'content-type:application/json' -d '{key_expr:"demo/example/**",db:"zenoh_example",create_db:true,volume:{id:"influxdb"}}' http://localhost:8000/@/router/local/config/plugins/storage_manager/storages/demo2
   ```
