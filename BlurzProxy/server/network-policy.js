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
    // Bound DNS cache retention; Wisp validates the resolved IP and connects to that same IP.
    dns_ttl: 30,
    dns_cache_size: 1024,
    // Do not trust client-supplied forwarding headers for connection identity.
    parse_real_ip: false,
    parse_real_ip_from: [],
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
