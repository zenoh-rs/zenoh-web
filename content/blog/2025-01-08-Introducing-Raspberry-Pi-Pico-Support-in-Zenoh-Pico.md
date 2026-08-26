---
title: "Introducing Raspberry Pi Pico Support in Zenoh-Pico"
date: 2025-01-08
menu: "blog"
weight: 20250108
description: "Paris — 8 January 2025"
draft: false
---

# Introducing Raspberry Pi Pico Support in Zenoh-Pico

We’re excited to announce that Zenoh-Pico now supports the Raspberry Pi Pico series, including the Pico W and Pico 2 W variants! Zenoh already runs seamlessly on platforms like the Raspberry Pi Zero, providing robust communication solutions for IoT. Now, with the addition of Raspberry Pi Pico support, we’ve expanded the Zenoh ecosystem to even smaller and more constrained devices.

{{< figure-inline
    src="../../img/20250108-Introducing-Raspberry-Pi-Pico-Support-in-Zenoh-Pico/pico-family.jpg"
    class="figure-inline"
    alt="Raspberry Pi Pico Family" >}}


## What is Zenoh-Pico?

Zenoh-Pico is the lightweight, native C implementation of the[ Eclipse Zenoh](http://zenoh.io) protocol, designed specifically for constrained devices. It provides a streamlined, low-resource API while maintaining compatibility with the main[ Rust Zenoh implementation](https://github.com/eclipse-zenoh/zenoh). Zenoh-Pico already supports a broad range of platforms and protocols, making it a versatile choice for embedded systems development.


## Why Raspberry Pi Pico?

The [Raspberry Pi Pico family](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html) is a cost-effective, feature-rich microcontroller platform based on the [RP2040](https://www.raspberrypi.com/documentation/microcontrollers/silicon.html#rp2040)/[RP2350](https://www.raspberrypi.com/documentation/microcontrollers/silicon.html#rp2350) chips. With its dual-core Arm Cortex-M0+ processor (or more advanced processors in the Pico 2 series), low power consumption, and extensive GPIO options, it’s a favorite among hobbyists and professionals alike. The addition of integrated Wi-Fi in the Pico W and Pico 2 W variants makes the platform even more suitable for IoT applications.

* **Raspberry Pi Pico and Pico W**:
    * **Processor**: Dual-core Arm Cortex M0+ processor at up to 133 MHz
    * **Flash memory**: 2 MB
    * **RAM**: 256 KB
    * **Connectivity**: GPIO, Serial (UART), USB (CDC), and Wi-Fi (Pico W only)
* **Raspberry Pi Pico 2 and Pico 2 W**:
    * **Processor**: Dual Arm Cortex-M33 or Hazard3 processors at up to 150MHz
    * **Flash memory**: 4 MB
    * **RAM**: 520 KB
    * **Connectivity**: GPIO, Serial (UART), USB (CDC), and Wi-Fi (Pico 2 W only)

With Zenoh-Pico’s support, developers can now leverage the Raspberry Pi Pico family for reliable and efficient data communication over:

* **Wi-Fi:** TCP/UDP, unicast and multicast (on Pico W versions)
* **Serial connections** (UART)
* **USB (CDC)** — an experimental feature that offers additional connectivity options.


## Technical Architecture

Zenoh-Pico for Raspberry Pi Pico uses the **Raspberry Pi Pico SDK** for hardware interfacing and communication protocols. It also integrates **FreeRTOS** to manage tasks and scheduling, providing a robust framework for real-time operations. This combination ensures efficient and reliable performance even under constrained conditions.


## Getting Started

Here’s how you can set up Zenoh-Pico examples on your Raspberry Pi Pico using Ubuntu 24.04:

### 1. Installation Prerequisites

Ensure your system has the required tools and libraries:

```
sudo apt update
sudo apt install -y cmake gcc-arm-none-eabi libnewlib-arm-none-eabi build-essential g++ libstdc++-arm-none-eabi-newlib
```

### 2. Set Up the Pico SDK

Clone and initialize the Raspberry Pi Pico SDK:

```
export PICO_SDK_PATH=$HOME/src/pico-sdk
mkdir -p $PICO_SDK_PATH
cd $PICO_SDK_PATH
git clone https://github.com/raspberrypi/pico-sdk.git .
git submodule update --init
```

### 3. Prepare the FreeRTOS Kernel

Clone the FreeRTOS Kernel repository:

```
export FREERTOS_KERNEL_PATH=$HOME/src/FreeRTOS-Kernel/
mkdir -p $FREERTOS_KERNEL_PATH
cd $FREERTOS_KERNEL_PATH
git clone https://github.com/FreeRTOS/FreeRTOS-Kernel.git .
git submodule update --init
```

### 4. Build the Examples

Navigate to the example directory and build them:

```
git clone //github.com/eclipse-zenoh/zenoh-pico.git .
cd zenoh-pico/examples/rpi_pico
cmake -Bbuild -DPICO_BOARD="pico_w" -DWIFI_SSID=wifi_network_ssid -DWIFI_PASSWORD=wifi_network_password -DZENOH_CONFIG_MODE=client -DZENOH_CONFIG_CONNECT="tcp/router_address:7447"
cmake --build ./build
```

### 5. Flash Your Raspberry Pi Pico device

Connect the Raspberry Pi Pico in bootloader mode and copy one of the generated `.uf2` files onto the device.


## Connectivity Options

### Serial Connection

To connect via UART, specify pins or predefined device name and baud rate:

e.g.

```
-DZENOH_CONFIG_CONNECT="serial/0.1#baudrate=38400"
-DZENOH_CONFIG_CONNECT="serial/uart1_0#baudrate=38400"
```

Valid PIN combinations and associated device names for Raspberry Pi Pico:

| `PINS` | `Device name` |
| --- | --- |
| `0.1` | `uart0_0` |
| `4.5` | `uart1_0` |
| `8.9` | `uart1_1` |
| `12.13` | `uart0_1` |
| `16.17` | `uart0_2` |


### USB Serial Connection (Experimental)

Enable this feature by compiling Zenoh-Pico with:

```
-DZ_FEATURE_LINK_SERIAL_USB -DZ_FEATURE_UNSTABLE_API
```

To connect via USB CDC, use:

```
-DZENOH_CONFIG_CONNECT="serial/usb#baudrate=112500"
```

On the host side, run:

```
zenohd -l serial//dev/ttyACM0#baudrate=112500
```

## Let’s Run the Zenoh Family on the Raspberry Pi Family

The flexibility of Zenoh allows for powerful and efficient IoT deployments across the Raspberry Pi ecosystem. Here’s an example scenario.

### Set Up the Zenoh Router

Install the Zenoh Router on a Raspberry Pi Zero:

```
wget https://github.com/eclipse-zenoh/zenoh/releases/download/1.1.0/zenoh-1.1.0-armv7-unknown-linux-gnueabi-standalone.zip
unzip zenoh-1.1.0-armv7-unknown-linux-gnueabihf-standalone.zip
```

Start the Zenoh router:

```
./zenohd
```

Find the locator in the router output:

```
2025-01-03T16:24:17.204829Z  INFO main ThreadId(01) zenoh::net::runtime::orchestrator: Zenoh can be reached at: tcp/192.168.0.207:7447
```

### Build Pico W Clients

Configure Zenoh-Pico Raspberry Pi Pico examples as it was shown above, but specify to use our router IP and build it:

```
cmake -Bbuild -DPICO_BOARD="pico_w" -DWIFI_SSID=WIFI_SSID -DWIFI_PASSWORD=********* -DZENOH_CONFIG_MODE=client -DZENOH_CONFIG_CONNECT="tcp/192.168.0.207:7447"
cmake --build ./build
```


### Deploy Pico W Clients

Hold the BOOTSEL button on Raspberry Pi Pico W and attach it to the USB port.

Copy compiled z_pub firmware image:

```
cp ./build/z_pub.uf2 /media/${USER}/RPI-RP2
```

Do the same with the z_sub and second Raspberry Pi Pico W device:

```
cp ./build/z_sub.uf2 /media/${USER}/RPI-RP2
```

### Check output

Connect to the Pico W Subscriber to check output:

```
❯ sudo tio /dev/ttyACM0 -e -m INLCRNL,ONLCRNL -b 115200
[18:12:42.639] Press ctrl-t q to quit
[18:12:46.643] Connected to /dev/ttyACM0
Wi-Fi connected.
IP Address: 192.168.0.249
Netmask: 255.255.255.0
Gateway: 192.168.0.3
Connect endpoint: tcp/192.168.0.207:7447
Opening client session ...
Declaring Subscriber on 'demo/example/**'...
>> [Subscriber] Received ('demo/example/zenoh-pico-pub': '[   0] [RPI] Pub from Zenoh-Pico!')
>> [Subscriber] Received ('demo/example/zenoh-pico-pub': '[   1] [RPI] Pub from Zenoh-Pico!')
>> [Subscriber] Received ('demo/example/zenoh-pico-pub': '[   2] [RPI] Pub from Zenoh-Pico!')
>> [Subscriber] Received ('demo/example/zenoh-pico-pub': '[   3] [RPI] Pub from Zenoh-Pico!')
>> [Subscriber] Received ('demo/example/zenoh-pico-pub': '[   4] [RPI] Pub from Zenoh-Pico!')
```

This setup showcases the seamless integration of Zenoh-Pico on Raspberry Pi Pico devices with a Zenoh router running on Raspberry Pi Zero, creating a scalable and efficient IoT ecosystem.

## Memory Usage Insights

Running Zenoh-Pico on the Raspberry Pi Pico W provides impressive efficiency. Here’s a brief summary of memory usage:


* **Flash Usage**: A basic configuration provided above consumes approximately 80 KB of flash memory.

    It is around 20% for Raspberry Pi Pico or 10 % for Raspberry Pi Pico 2 !

* **RAM Usage**: Zenoh typically uses around 12 KB of RAM for this configuration.

    It is around 5% for Raspberry Pi Pico or 2% for Raspberry Pi Pico 2 !


## Future-Proofing IoT Applications

With support for the Raspberry Pi Pico, Zenoh-Pico continues to lead in providing robust, scalable, and efficient communication solutions for constrained devices. Whether you’re building home automation systems, industrial IoT solutions, or experimenting with new ideas, Zenoh-Pico and Raspberry Pi Pico make a powerful combination.

Additionally, the main Rust-based Zenoh implementation is fully compatible with the Raspberry Pi Zero, making it an excellent choice for edge routers in distributed systems.

We’re eager to see what the community builds with this new capability! For more details, check out the[ Zenoh-Pico repository](https://github.com/eclipse-zenoh/zenoh-pico) and join the discussion on our[ community channels](http://zenoh.io/community/).

Let’s build the future of IoT together!

**-- [Alexander Bushnev](https://github.com/sashacmc)**
