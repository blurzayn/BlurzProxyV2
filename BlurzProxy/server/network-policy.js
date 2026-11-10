function configureWispNetworkPolicy(wisp) {
  if (!wisp || !wisp.options) throw new TypeError("A Wisp server instance is required.");

  Object.assign(wisp.options, {
    allow_private_ips: false,
    allow_loopback_ips: false,
    allow_direct_ip: false,
    allow_udp_streams: false,
    allow_tcp_streams: true,
    port_whitelist: [80, 443],
    stream_limit_per_host: 16,
    stream_limit_total: 64,
    hostname_blacklist: [
      /(^|\.)localhost$/i,
      /(^|\.)local$/i,
      /(^|\.)internal$/i,
      /(^|\.)localhost\.localdomain$/i,
      /^metadata(?:\.|$)/i,
      /^metadata\.google\.internal$/i,
      /^instance-data(?:\.|$)/i
    ]
  });

  return wisp.options;
}

module.exports = { configureWispNetworkPolicy };
