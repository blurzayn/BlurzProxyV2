function evaluateReadiness({ packages, checkPackage, wisp }) {
  if (!Array.isArray(packages) || typeof checkPackage !== "function" || !wisp?.options) {
    return false;
  }

  const dependenciesReady = packages.every((name) => checkPackage(name)?.installed === true);
  const policy = wisp.options;
  const transportReady = typeof wisp.routeRequest === "function" &&
    policy.allow_private_ips === false &&
    policy.allow_loopback_ips === false &&
    policy.allow_direct_ip === false &&
    policy.allow_udp_streams === false &&
    Array.isArray(policy.port_whitelist) &&
    policy.port_whitelist.length === 2 &&
    policy.port_whitelist.includes(80) &&
    policy.port_whitelist.includes(443);

  return dependenciesReady && transportReady;
}

module.exports = { evaluateReadiness };
