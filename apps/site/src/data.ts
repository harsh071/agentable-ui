export interface Order {
  id: string;
  customer: string;
  email: string;
  total: number;
  status: "pending" | "paid" | "shipped" | "refunded" | "cancelled";
  region: "NA" | "EU" | "APAC" | "LATAM";
  placedAt: string;
  items: number;
}

const names = ["Ada Lovelace", "Grace Hopper", "Linus Torvalds", "Margaret Hamilton", "Ken Thompson", "Barbara Liskov", "Dennis Ritchie", "Frances Allen", "Alan Kay", "Radia Perlman", "Guido van Rossum", "Anita Borg", "Bjarne Stroustrup", "Hedy Lamarr", "Tim Berners-Lee", "Katherine Johnson"];
const statuses: Order["status"][] = ["pending", "paid", "shipped", "refunded", "cancelled"];
const regions: Order["region"][] = ["NA", "EU", "APAC", "LATAM"];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function makeOrders(n = 140): Order[] {
  const r = rng(42);
  return Array.from({ length: n }, (_, i) => {
    const name = names[Math.floor(r() * names.length)]!;
    const day = Math.floor(r() * 60);
    return {
      id: `ORD-${1000 + i}`,
      customer: name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      total: Math.round((20 + r() * 980) * 100) / 100,
      status: statuses[Math.floor(r() * statuses.length)]!,
      region: regions[Math.floor(r() * regions.length)]!,
      placedAt: new Date(Date.UTC(2026, 7, 1 + day)).toISOString().slice(0, 10),
      items: 1 + Math.floor(r() * 6),
    };
  });
}

export const customers = names.map((n, i) => ({ value: `cust_${i + 1}`, label: n, description: `${n.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com` }));

export const integrations = ["Stripe", "Shopify", "Slack", "HubSpot", "Zendesk", "Mailchimp", "QuickBooks", "Salesforce", "Intercom", "Segment", "Twilio", "SendGrid", "Notion", "Airtable", "Zapier", "GitHub", "Linear", "Jira", "Figma", "Google Analytics"];
