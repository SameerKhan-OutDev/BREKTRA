import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";
import { isIP } from "node:net";

export const loopbackPeer = (address = "") => address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1";
const ipv4 = (address: string) => address.split(".").reduce((value, part) => (value << 8) | Number(part), 0) >>> 0;
const privateIPv4 = (address: string) => isIP(address) === 4 &&
  (address.startsWith("10.") || address.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(address));

export function lanInterfaces(interfaces = networkInterfaces()): NetworkInterfaceInfo[] {
  return Object.values(interfaces).flatMap(items => items || [])
    .filter(item => !item.internal && item.family === "IPv4" && privateIPv4(item.address))
    // Locally administered MACs commonly belong to virtual/host-only adapters.
    // This is a preference only; all interfaces remain available to choose.
    .sort((a, b) => (parseInt(a.mac.slice(0, 2), 16) & 2) - (parseInt(b.mac.slice(0, 2), 16) & 2));
}
export function lanPeer(address: string, interfaces = lanInterfaces()) {
  const peer = address.replace(/^::ffff:/, "");
  return privateIPv4(peer) && interfaces.some(item =>
    (ipv4(peer) & ipv4(item.netmask)) === (ipv4(item.address) & ipv4(item.netmask)));
}
export function lanUrls(port: number) {
  return [...new Set(lanInterfaces().map(item => `http://${item.address}:${port}`))];
}

export interface InvitationNetwork { lan: boolean; urls: string[] }
// Preserve the current LAN interface where possible; loopback is never a LAN invitation.
export function invitationOrigins(hosted: boolean, publicOrigin: string, requestHost: string, network: InvitationNetwork) {
  if (hosted) return [publicOrigin];
  if (!network.lan) return [`http://${requestHost}`];
  const urls = [...new Set(network.urls)];
  if (!urls.length) throw new Error("No LAN address is available. Connect this PC to WiFi or Ethernet before inviting teammates.");
  const current = `http://${requestHost}`;
  return urls.includes(current) ? [current, ...urls.filter(url => url !== current)] : urls;
}
