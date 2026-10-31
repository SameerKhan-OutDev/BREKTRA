import { useEffect, useState } from "react";
import { featureApi } from "./access";

export function NetworkAccess() {
  const [network, setNetwork] = useState<{ lan: boolean; hosted: boolean; urls: string[]; authenticated: boolean }>();
  const [error, setError] = useState("");
  useEffect(() => {
    void featureApi("/network").then(setNetwork).catch(e => setError(e.message));
  }, []);
  return <section className="panel workspace-setup" aria-labelledby="network-title">
    <div className="panel-header"><div><h2 id="network-title">Access from other devices</h2><p>Use the same workspace from a phone, tablet or computer.</p></div></div>
    {error ? <p role="alert">{error}</p> : !network ? <p>Checking network access…</p> : network.hosted ?
      <p>Share this workspace's HTTPS address. Each teammate signs in with their own account.</p> : network.lan ? <>
        <p>Connect to the same network and open one of these addresses. Keep this PC awake and BREKTRA running.</p>
        <p>Bookmark the address for your network. The portable app uses port 4310 by default and keeps the same port on restart. Run one installation; stop older copies before starting a fresh one.</p>
        <p>For a lasting LAN address, reserve this PC’s IP in your router. Moving networks or a changed router assignment can change the address.</p>
        <div className="setup-buttons">{network.urls.map(url => <a className="button" key={url} href={url}>{url}</a>)}</div>
        {!network.urls.length && <p>No private network address was found. Connect this PC to WiFi or Ethernet and reload Settings.</p>}
        <p>{network.authenticated ? "Each browser signs in to the shared workspace." : "Trusted LAN access: devices open this workspace directly with full access, without a login."}</p>
        <p>If a device cannot connect, run ALLOW LAN ACCESS on this PC and approve the Windows administrator prompt. Guest WiFi or router device isolation can block connections.</p>
        <p>Manage spreadsheet credentials and local AI setup on this PC. Account authorization callbacks also use this PC's browser. Use authenticated HTTPS hosting for access beyond your trusted LAN.</p>
      </> : <p>LAN sharing is off. Enable BREKTRA_LAN=1 and restart BREKTRA to share on a trusted network.</p>}
  </section>;
}
