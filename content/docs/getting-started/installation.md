---
title: "Installation"
weight : 2200
menu:
  docs:
    parent: getting_started
---

<!-- To get up and running with <b>Zenoh</b> you will have to install the router or the client (possibly both).  -->
To start playing with <b>Zenoh</b> we need the Zenoh router and/or the Zenoh client library. 
## Installing client library
To develop your application Zenoh, you need to install a Zenoh client library.
Depending on your programming language, pick one of the following API and refer to the installation and usage instructions in here:

- [Rust API](https://crates.io/crates/zenoh)
- [Python API](https://github.com/eclipse-zenoh/zenoh-python)
- [C API](https://github.com/eclipse-zenoh/zenoh-c)
- [C++ API](https://github.com/eclipse-zenoh/zenoh-cpp)
- [Java API](https://github.com/eclipse-zenoh/zenoh-java)
- [Kotlin API](https://github.com/eclipse-zenoh/zenoh-kotlin)
- [Pico API](https://github.com/eclipse-zenoh/zenoh-pico): A port of Zenoh in C, targeted at low-power devices.

Note that if you wish to always have access to all of Zenoh's latest features, Rust is Zenoh's original language, and will therefore always be the most feature-complete version.

## Installing the Zenoh router
The Zenoh router (a.k.a. `zenohd`) and its plugins are currently available as pre-built binaries for various platforms. All release packages can be downloaded from:  
  -  **https://download.eclipse.org/zenoh/zenoh/latest/**

Each subdirectory has the name of the Rust target. See the platforms each target corresponds to on https://doc.rust-lang.org/stable/rustc/platform-support.html

You can also install it via a package manager on macOS (homebrew) or Linux Debian (apt). See instructions below.

For other platforms, you can use the [Docker image](../quick-test#run-zenoh-in-docker) or [build it](https://github.com/eclipse-zenoh/zenoh#how-to-build-it) directly on your platform.

### MacOS
Tap our brew package repository:

```bash
$ brew tap eclipse-zenoh/homebrew-zenoh
```

Install Zenoh:

```bash
$ brew install zenoh
```

Then you can start the Zenoh router with this command:

```bash
$ zenohd
```

### Ubuntu or any Debian

Add Eclipse Zenoh public key to apt keyring

```bash
$ curl -L https://download.eclipse.org/zenoh/debian-repo/zenoh-public-key | sudo gpg --dearmor --yes --output /etc/apt/keyrings/zenoh-public-key.gpg
```

Add Eclipse Zenoh private repository to the sources list:

```bash
$ echo "deb [signed-by=/etc/apt/keyrings/zenoh-public-key.gpg] https://download.eclipse.org/zenoh/debian-repo/ /" | sudo tee -a /etc/apt/sources.list > /dev/null
$ sudo apt update
```

Install Zenoh:

```bash
$ sudo apt install zenoh
```

Then you can start the Zenoh router with this command:

```bash
$ zenohd
```

### Windows

Download the Zenoh archive from https://download.eclipse.org/zenoh/zenoh/latest/ :
- For Windows 64 bits: get the `x86_64-pc-windows-msvc/zenoh-<version>-x86_64-pc-windows-msvc.zip`file

Unzip the archive.

Go to Zenoh directory and start Zenoh router:

```cmd
> cd C:\path\to\zenoh\dir
> zenohd.exe
```

## Testing Your Installation
To test the installation, try to see the Zenoh man page by executing the following command:

```bash
$ zenohd --help
```
You should see the following output on your console:

```text
2024-08-12T13:27:29.724708Z  INFO main ThreadId(01) zenohd: zenohd v0.11.0-dev-965-g764be602d built with rustc 1.75.0 (82e1608df 2023-12-21)
The zenoh router

Usage: zenohd [OPTIONS]

Options:
  -c, --config <PATH>
          The configuration file. Currently, this file must be a valid JSON5 or YAML file

  -l, --listen <ENDPOINT>
          Locators on which this router will listen for incoming sessions. Repeat this option to open several listeners

  -e, --connect <ENDPOINT>
          A peer locator this router will try to connect to. Repeat this option to connect to several peers

  -i, --id <ID>
          The identifier (as an hexadecimal string, with odd number of chars - e.g.: A0B23...) that zenohd must use. If not set, a random unsigned 128bit integer will be used. WARNING: this identifier must be unique in the system and must be 16 bytes maximum (32 chars)!

  -P, --plugin <PLUGIN>
          A plugin that MUST be loaded. You can give just the name of the plugin, zenohd will search for a library named 'libzenoh_plugin_\<name\>.so' (exact name depending the OS). Or you can give such a string: "\<plugin_name\>:\<library_path\>" Repeat this option to load several plugins. If loading failed, zenohd will exit

      --plugin-search-dir <PATH>
          Directory where to search for plugins libraries to load. Repeat this option to specify several search directories

      --no-timestamp
          By default zenohd adds a HLC-generated Timestamp to each routed Data if there isn't already one. This option disables this feature

      --no-multicast-scouting
          By default zenohd replies to multicast scouting messages for being discovered by peers and clients. This option disables this feature

      --rest-http-port <SOCKET>
          Configures HTTP interface for the REST API (enabled by default on port 8000). Accepted values: - a port number - a string with format `<local_ip>:<port_number>` (to bind the HTTP server to a specific interface) - `none` to disable the REST API

      --cfg <CFG>
          Allows arbitrary configuration changes as column-separated KEY:VALUE pairs, where: - KEY must be a valid config path. - VALUE must be a valid JSON5 string that can be deserialized to the expected type for the KEY field.
          
          Examples: - `--cfg='startup/subscribe:["demo/**"]'` - `--cfg='plugins/storage_manager/storages/demo:{key_expr:"demo/example/**",volume:"memory"}'`

      --adminspace-permissions <[r|w|rw|none]>
          Configure the read and/or write permissions on the admin space. Default is read only

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version

```

