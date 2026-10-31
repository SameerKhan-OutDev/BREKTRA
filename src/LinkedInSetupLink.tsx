import { ExternalLink } from "lucide-react";

/** LinkedIn requires an app selection before Products or Auth can be opened. */
export function LinkedInSetupLink({ section }: { section?: "Products" | "Auth" }) {
  return <div className="linkedin-setup-link">
    <a className="button" href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer">
      {section ? `Open LinkedIn app → ${section}` : "Open LinkedIn developer portal"} <ExternalLink size={14}/>
    </a>
    <p className="feature-help">{section ? `Select your team’s app, then choose ${section}.` : "Open your team’s existing app, or choose Create app."} Opens in a new tab; keep BREKTRA open here.</p>
  </div>;
}
