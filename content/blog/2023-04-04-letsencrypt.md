---
title: "Securing Zenoh with LetsEncrypt: A Comprehensive Guide"
date: 2023-04-04
menu: "blog"
weight: 20230404
description: "Paris — 4 April 2023"
draft: false
---

Over the last months, many people have reached out to us in our [Discord server](https://discord.gg/vSDSpqnbkm) to ask if Zenoh was compatible with LetsEncrypt when using TLS as the communication transport. In other words, how to use LetsEncrypt with Zenoh.

In this blog post we'll show it is indeed possible and we'll go through the steps needed in order to set everything up. If you are already familiar with Transport Layer Security and LetsEncrypt, feel free to skip the explanation and [dive straight into the tutorial](#how-to-use-letsencrypt-with-zenoh).

## Transport Layer Security (TLS)

Before we dive into LetsEncrypt, it may be useful for readers who are not familiar with Transport Layer Security (TLS) to get a brief introduction. TLS is a cryptographic protocol designed to provide security and privacy for communication over the internet (or any type of IP-based network). It is used to establish an encrypted connection between two peers in order to ensure that information is transmitted securely. For instance, it is widely used for securing web connections by the HTTPS protocol.

Zenoh [supports both TLS and mTLS (mutual TLS) as communication transports](../2023-01-10-zenoh-charmander).

Checkout our documentation on [how to configure TLS on Zenoh](../../docs/manual/tls). There, we explain how to set up the configuration for Zenoh in order to use the generated keys and certificates from a tool named [MiniCA](https://github.com/jsha/minica), which _"is a small, simple CA intended for use in situations where the CA operator also operates each host where a certificate will be used"_.

### What are Certificate authorities (CAs)?

Certificate authorities (CAs) play two-fold role in the operation of TLS (i) verifying the identity of the sender/receiver of a message; and (ii) providing the means to cypher/decypher messages between sender and receiver (i.e., associate an entity to their public key).

When a client requests a secure connection to a server, the server replies by presenting its digital certificate to the client. This certificate contains information about the server's identity, including its public key, which is used to establish an encrypted connection with the client.

To ensure the authenticity and integrity of the server's digital certificate, it must be signed by a trusted third-party CA (for instance MiniCA if we handle the certificates by our own means). This helps to establish trust and security in the TLS protocol.

Nowadays, there are several trusted third-party certificate authorities used to verify a server's integrity. Many of them constitute what is known as the Web Public Key Infrastructure (Web PKI), a system where certificate authorities form a chain of trust to issue certificates required by web browsers and other applications. When establishing a secure connection over HTTPS, the client application checks the certificate chain to ensure that the certificate was issued by a trusted CA and that it has not been revoked or expired. If the certificate is valid and trusted, the browser or client application establishes an encrypted connection with the server.

![LetsEncrypt Logo](https://raw.githubusercontent.com/letsencrypt/website/master/static/images/letsencrypt-logo-horizontal.svg)[^2]

[LetsEncrypt](https://letsencrypt.org/) is a free, automated, and open certificate authority (part of the WebPKI) that provides digital certificates for enabling HTTPS (SSL/TLS) encryption on websites. It was launched in 2015 by the Internet Security Research Group (ISRG) with the aim of making it easier for website owners to secure their sites with SSL/TLS certificates and today is a member of the Web PKI ecosystem. Let's Encrypt is unique in that it offers digital certificates that are automatically issued, renewed, and managed, with no cost to the website owner. This removes the cost and technical complexity of obtaining and managing SSL/TLS certificates, and makes it easier for website owners to encrypt their traffic and protect their users' privacy.

## How to use LetsEncrypt with Zenoh

Loading the WebPKI's certificate authorities is the default behavior of Zenoh when setting up a TLS communication when not specifying the `root_ca_certificate` field. However, this requires hosting the Zenoh router on a public server with a DNS domain, as the certificate authorities will very rarely provide certificates bound to a static IP address.

The next step is to get the LetsEncrypt certificates. For that we need to solve one of the [challenges](https://letsencrypt.org/docs/challenge-types/) within our server. Here we will use the HTTP-01 challenge, which, as explained in the LetsEncrypt [documentation](https://letsencrypt.org/docs/challenge-types/#http-01-challenge):

_"This is the most common challenge type today. Let’s Encrypt gives a token to your ACME client, and your ACME client puts a file on your web server at `http://<YOUR_DOMAIN>/.well-known/acme-challenge/<TOKEN>`. That file contains the token, plus a thumbprint of your account key. Once your ACME client tells Let’s Encrypt that the file is ready, Let’s Encrypt tries retrieving it (potentially multiple times from multiple vantage points). If our validation checks get the right responses from your web server, the validation is considered successful and you can go on to issue your certificate. If the validation checks fail, you’ll have to try again with a new certificate."_

Even simpler to work with this challenge is when using [Lego](https://go-acme.github.io/lego/), which is a _"Let’s Encrypt client and ACME library written in Go"_. Lego will setup a short lived web server with the only purpose of storing the acme challenge token for LetsEncrypt to retrieve it.

Let's suppose we have a router hosted on `router.zenoh.io`. As explained in the [Lego documentation](https://go-acme.github.io/lego/usage/cli/obtain-a-certificate/#using-the-built-in-web-server), we need to run the following command:

```
lego --email="your@email.com" --domains="router.zenoh.io" --http run
```

It may be necessary to run it with sudo unless you setup the [proper configuration](https://go-acme.github.io/lego/usage/cli/options/#running-without-root-privileges). Also the ports 80 and 443 of our server must be available in order for LetsEncrypt to be able to retrieve the ACME token.

After that you should get the LetsEncrypt certificates under a `.lego` directory (note the directory is hidden by default):

```
$ ls ~/.lego
  router.zenoh.io.crt
  router.zenoh.io.issuer.crt
  router.zenoh.io.json
  router.zenoh.io.key
```

Once we have that, in our config, when setting up the tls connection, we will use `router.zenoh.io.crt` and `router.zenoh.io.key`.

```
{
  mode: "router",
  listen: {
    endpoints: ["tls/[::]:7447"],
  },
  transport: {
    link: {
      tls: {
        // The root_ca_certificate field is disabled
        server_private_key: "router.zenoh.io.key",
        server_certificate: "router.zenoh.io.crt",
      },
    },
  },
}
```

Note we did not specify the `root_ca_certificate` field. That is because (as we mentioned before) the default behavior in that case is to load the WebPKI certificates.

Now you are all set to run a zenoh router with TLS loading LetsEncrypt certificates.
Let's set for instance the [zenoh examples](https://github.com/eclipse-zenoh/zenoh/tree/master/examples) to see it works!

Let's start our router. In our server terminal run:

```
./zenohd -c config.json5
```

where `config.json5` is the config above.

We can now run a publisher and a subscriber to see how the traffic flows through the router:

Running the publisher

```
./z_pub -m client -e tls/router.zenoh.io:7447
```

you should see:

```
Opening session...
Declaring Publisher on 'demo/example/zenoh-rs-pub'...
Putting Data ('demo/example/zenoh-rs-pub': '[   0] Pub from Rust!')...
Putting Data ('demo/example/zenoh-rs-pub': '[   1] Pub from Rust!')...
Putting Data ('demo/example/zenoh-rs-pub': '[   2] Pub from Rust!')...
Putting Data ('demo/example/zenoh-rs-pub': '[   3] Pub from Rust!')...
Putting Data ('demo/example/zenoh-rs-pub': '[   4] Pub from Rust!')...
Putting Data ('demo/example/zenoh-rs-pub': '[   5] Pub from Rust!')...
```

And for the subscriber:

```
./z_sub -m client -e tls/router.zenoh.io:7447
```

```
Opening session...
Declaring Subscriber on 'demo/example/**'...
Enter 'q' to quit...
>> [Subscriber] Received PUT ('demo/example/zenoh-rs-pub': '[   0] Pub from Rust!')
>> [Subscriber] Received PUT ('demo/example/zenoh-rs-pub': '[   1] Pub from Rust!')
>> [Subscriber] Received PUT ('demo/example/zenoh-rs-pub': '[   2] Pub from Rust!')
>> [Subscriber] Received PUT ('demo/example/zenoh-rs-pub': '[   3] Pub from Rust!')
>> [Subscriber] Received PUT ('demo/example/zenoh-rs-pub': '[   4] Pub from Rust!')
>> [Subscriber] Received PUT ('demo/example/zenoh-rs-pub': '[   5] Pub from Rust!')
```

Success!

It's interesting to see the logs on debug mode (for instance with `RUST_LOG=debug ./z_pub -m client -e tls/router.zenoh.io:7447`) as you will see the TLS communication being established

```
[2023-03-24T10:24:33Z DEBUG zenoh_link_tls::unicast] Field 'root_ca_certificate' not specified. Loading default Web PKI certificates instead.
[2023-03-24T10:24:33Z DEBUG rustls::client::hs] No cached session for DnsName(DnsName(DnsName("router.zenoh.io")))
[2023-03-24T10:24:33Z DEBUG rustls::client::hs] Not resuming any session
[2023-03-24T10:24:33Z DEBUG rustls::client::hs] Using ciphersuite TLS13_AES_256_GCM_SHA384
[2023-03-24T10:24:33Z DEBUG rustls::client::tls13] Not resuming
[2023-03-24T10:24:33Z DEBUG rustls::client::tls13] TLS1.3 encrypted extensions: [ServerNameAck]
[2023-03-24T10:24:33Z DEBUG rustls::client::hs] ALPN protocol is None
[2023-03-24T10:24:33Z DEBUG rustls::client::tls13] Ticket saved
...
```

meaning that the WebPKI (and therefore LetsEncrypt) validated the router's identity.

## Conclusion

This covers so far how to secure our communications using TLS on Zenoh with LetsEncrypt certificates. More details can be found in the [documentation](https://zenoh.io/docs/manual/tls/) regarding how to set up a TLS communication with Zenoh. Don’t hesitate to join and ask your questions in our [Discord community](https://discord.gg/vSDSpqnbkm).

[^2]: _By raw.githubusercontent.com/letsencrypt/website/master/static/images/letsencrypt-logo-horizontal.svg, Fair use, https://en.wikipedia.org/w/index.php?curid=47031340_
