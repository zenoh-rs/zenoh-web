---
title: "Migrating from Zenoh-C to Zenoh-Pico (and vice-versa)"
weight : 5700
menu:
  docs:
    parent: migration_0.5_to_0.6
---

Both Zenoh-C and Zenoh-Pico APIs offer a C client API for the zenoh protocol, thus this release took an extra step to make Zenoh-C code to be compatible with Zenoh-Pico code (and vice-versa). Such approach aids users to easily migrate its Zenoh-based code to microcontrollers and embedded systems.

Nevertheless, in order to keep your code optimal some minor changes might be required while moving from Zenoh-C to Zenoh-Pico:
  - **zc_\*** refers to Zenoh-C API only, while **zp_\*** refers to Zenoh-Pico API only.
  - Zenoh **configurations** are handled in a different way.
  - **Read** and **Lease** tasks must be spawn and destroyed explicitly by the user.
  - Keyexpr to_string vs resolve

Everything else should be copy-paste friendly. Note that, although the API between Zenoh-C and Zenoh-Pico are the same, their ABI is different w.r.t. how parameters are passed to functions. Still, **z_loan** and **z_move** hide those differences from the user.

## zc_\* and zp_\*
In order to help users to identify what functions / helpers are Zenoh-C or Zenoh-Pico exclusive, they are prefixed respectively with **zc_\*** and **zp_\***. Everything else (i.e., **z_\*** functions and helpers) are common to both APIs.

For the moment, their use is limited to the Zenoh configurations (to support more idiomatic usages on their target platform), and tasks (to support single-thread or multi-thread in Zenoh-Pico). 

## Zenoh configurations
Due to system-wide differences between microcontrollers / embedded systems and computers, configurations must be handled in more idiomatic way. While computers can easily handle configuration files that are passed to running processes, microcontrollers / embedded systems tend to leverage more on compile-time configurations with limited runtime-configurations.

In Zenoh-Pico, both types of configurations are available (check `/path/to/zenoh-pico/include/zenoh-pico/config.h`). On one hand, compile-time configurations can be done directly on the previous file, defined on the user code, or as build flags. On the other hand, runtime configurations are handled as a `key-string` mapping, as the following example:

```
z_owned_config_t config = z_config_default();
zp_config_insert(z_loan(config), Z_CONFIG_PEER_KEY, z_string_make("tcp/192.168.0.1:7447"));
zp_config_insert(z_loan(config), Z_CONFIG_MODE_KEY, z_string_make("client"));
zp_config_insert(z_loan(config), Z_CONFIG_SCOUTING_TIMEOUT_KEY, z_string_make("2000"));
```

In Zenoh-C, configuration may be loaded from JSON5 or YAML files, and is generally interacted in-code through JSON5. 
```
z_owned_config_t config = z_config_default();
zc_config_insert_json(z_loan(config), Z_CONFIG_MODE_KEY, "\"client\"");
char *mode = zc_config_get(z_loan(config), Z_CONFIG_MODE_KEY);
assert(mode == "\"client\"");
free(mode);
```

## Read and Lease tasks (Zenoh-Pico only)

As Zenoh-Pico is targeting microcontrollers and embedded systems, it is a requirement to support both single-thread and multi-thread implementations. To do so, the user has explicit control over the read and lease tasks.

If **multi-thread behavior** is intended, the user must spawn both tasks manually by including the following lines after Zenoh Session is successfully open.
```
zp_start_read_task(z_loan(session), NULL);
zp_start_lease_task(z_loan(session), NULL);
```

Likewise, the user must also destroy both tasks manually by including the following lines just before closing the session:
```
zp_stop_read_task(z_loan(session));
zp_stop_lease_task(z_loan(session));
```
Note that, ```z_close(z_move(s));``` will stop and destroy the tasks if the user forgets to do it. However, for the sake of symmetric  operations, the user is advised to stop them manually.

If **single-thread behavior** is intended, the user **must not** spawn the any of the tasks. Instead, the user can a single execution of the read task and lease tasks at its own pace:
```
zp_read(z_loan(session), NULL);
zp_send_keep_alive(z_loan(session), NULL);
zp_send_join(z_loan(session), NULL);
```

## Keyexpr to_string vs resolve

Zenoh-C and Zenoh-Pico store keyexpr in a sligly different way. While Zenon-C stores full expanded string for the keyexprs, Zenoh-Pico might store them in their declared form as a requirement for constrained devices. Thus, Zenoh-Pico requires to reconstruct the full expanded string for the keyexpr by using the `z_keyexpr_resolve`. In turn, Zenoh-C is able to return a pointer to the already full expanded string (by using `z_keyexpr_to_string`). Note that, in both cases extra memory allocations are performed that **must** be released by the user.

## zc_init_logger

By default, `z_open` and `z_scout` will initialize the Zenoh logger.

If you'd rather disable the logger (or have the option to), you may build zenoh-c with `DISABLE_LOGGER_AUTOINIT=true` in your cmake configuration options.
If you do so, you may still initialize the logger manually using `zc_init_logger`.


## How to write code compatible with Zenoh-C and Zenoh-Pico simultaneously

To enable the user to write code that works for both Zenoh-C and Zenoh-Pico simultaneously, both introduce a set of define directives.

For Zenoh-C:
```C
#define ZENOH_C "0.6.0"
#define ZENOH_C_MAJOR 0
#define ZENOH_C_MINOR 6
#define ZENOH_C_PATCH 0
```

For Zenoh-Pico:
```C
#define ZENOH_PICO "0.6.0"
#define ZENOH_PICO_MAJOR 0
#define ZENOH_PICO_MINOR 6
#define ZENOH_PICO_PATCH 0
```

By using them, the user can have code that is only compiled against Zenoh-C or Zenoh-Pico libraries. For example:
```C
// (...)
z_owned_config_t config = z_config_default();

#ifdef ZENOH_C
z_config_insert_json(z_loan(config), Z_CONFIG_CONNECT_KEY, "tcp/192.168.0.1:7447"))
#endif

#ifdef ZENOH_PICO
  zp_config_insert(z_loan(config), Z_CONFIG_PEER_KEY, z_string_make("tcp/192.168.0.1:7447"));
#endif

// (...)
```
