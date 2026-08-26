---
title: "Streamlining Zenoh router Monitoring with Datadog Integration"
date: 2024-04-17
menu: "blog"
weight: 20240417
description: "Paris — 17 April 2024"
draft: false
---

{{< figure-inline
    src="../../img/20240417-Datadog-Zenoh-Router-Integration/1-dashboard.png"
    class="figure-inline"
    alt="Integration Dashboard" >}}

## Unlocking Insights, Enhancing Efficiency

Today, we're excited to introduce a powerful integration that greatly improves  the monitoring experience for [Zenoh](https://zenoh.io/) users. While Zenoh has always prioritized efficiency and performance, our [Datadog integration](https://docs.datadoghq.com/integrations/zenoh_router/) brings a new dimension of visibility and insight to Zenoh deployments. By seamlessly integrating with Datadog, users can now monitor the state of their Zenoh routers with unprecedented ease and efficiency.

## Empowering Zenoh Users

The Zenoh Team  understands the importance of providing users with the tools they need to manage their distributed systems effectively. With this integration, we're empowering Zenoh users to gain valuable insights into router performance, network dynamics, and system health without sacrificing efficiency. By leveraging the robust monitoring capabilities of Datadog, users can optimize their Zenoh deployments with confidence.

## A Tailored Solution for Cloud Environments

For users operating in cloud environments, the Zenoh router Datadog integration offers tailored monitoring solutions that streamline operations and enhance visibility. By seamlessly integrating with Datadog's cloud monitoring platform, users can easily monitor the state of their Zenoh routers in real time, allowing for proactive management and optimization of cloud-based deployments.

## Key Features of the Integration:

1. **Router Metrics**: Gain insights into essential metrics such as throughput, different message rates, etc. to assess the performance of Zenoh routers.
2. **Connection Status**: Monitor the status of connections between routers, peers, and clients to detect any anomalies or issues.
3. **Alerting**: Use predefined or set up custom alerts based on thresholds to proactively identify and address potential issues before they impact the system.


## How It Works

The Zenoh router integration for Datadog is implemented as an agent plugin that collects relevant metrics and status information from Zenoh routers and sends them to the Datadog platform. Users can then visualize and analyze this data using Datadog's intuitive dashboarding and querying capabilities.

{{< figure-inline
    src="../../img/20240417-Datadog-Zenoh-Router-Integration/2-agent.png"
    class="figure-inline"
    alt="Datadog Agent Overview" >}}

## Getting Started

To start monitoring Zenoh routers with Datadog, simply install the [Zenoh router integration plugin](https://docs.datadoghq.com/integrations/zenoh_router/) on your Datadog agent, configure it with the necessary connection details, and start exploring the metrics and status information available in Datadog.

1. Install integration on Datadog website

{{< figure-inline
    src="../../img/20240417-Datadog-Zenoh-Router-Integration/3-integration-tile.png"
    class="figure-inline"
    alt="Integration Tile" >}}

2. Install the Datadog agent plugin on one of your servers where the Datadog agent is already installed.

```console
> datadog-agent integration install -t datadog-zenoh_router==1.0.0
```

3. Create file `/etc/datadog-agent/conf.d/zenoh_router.d/conf.yaml` with the content

```yaml
init_config:

instances:
 -
   min_collection_interval: 30
   url: http://your_zenoh_router_address:8000
```

4. Restart the agent

```console
> sudo systemctl restart datadog-agent
```

5. Begin by using preconfigured dashboards and monitors, or alternatively, create custom ones according to your needs

{{< figure-inline
    src="../../img/20240417-Datadog-Zenoh-Router-Integration/4-dashboards.png"
    class="figure-inline"
    alt="Dashboards" >}}

{{< figure-inline
    src="../../img/20240417-Datadog-Zenoh-Router-Integration/5-monitors.png"
    class="figure-inline"
    alt="Monitors" >}}

## Conclusion

By integrating Zenoh routers with Datadog, we can enhance observability and gain valuable insights into the performance and status of our distributed Zenoh system. This integration empowers teams to monitor, troubleshoot, and optimize Zenoh deployments effectively, ensuring the reliability and efficiency of their applications.

**-- [Alexander Bushnev](https://github.com/sashacmc) for the [Zenoh team](https://github.com/orgs/eclipse-zenoh/people)**
