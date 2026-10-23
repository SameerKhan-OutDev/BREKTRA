// A browser adapter can be added here after verified read/action experiments.
// The foundation deliberately exposes no live outbound LinkedIn capability.
export interface LinkedInAdapter {
  sendRequest(profileUrl: string): Promise<{ confirmed: boolean }>;
  sendPitch(profileUrl: string, text: string): Promise<{ confirmed: boolean }>;
}
export class DisconnectedLinkedInAdapter implements LinkedInAdapter {
  async sendRequest(_profileUrl: string): Promise<never> {
    throw new Error("LinkedIn adapter is not connected.");
  }
  async sendPitch(_profileUrl: string, _text: string): Promise<never> {
    throw new Error("LinkedIn adapter is not connected.");
  }
}
