// Sample port database (UN/LOCODE). The manual notes ports are delivered via
// the shore configuration and can be requested if missing (§4.8). This is a
// representative seed list used by the onboard app.
export interface Port {
  code: string; // UN/LOCODE
  name: string;
  country: string;
}

export const PORTS: Port[] = [
  { code: 'DEHAM', name: 'Hamburg', country: 'Germany' },
  { code: 'DEBRV', name: 'Bremerhaven', country: 'Germany' },
  { code: 'NLRTM', name: 'Rotterdam', country: 'Netherlands' },
  { code: 'BEANR', name: 'Antwerp', country: 'Belgium' },
  { code: 'GBSOU', name: 'Southampton', country: 'United Kingdom' },
  { code: 'GBFXT', name: 'Felixstowe', country: 'United Kingdom' },
  { code: 'ESALG', name: 'Algeciras', country: 'Spain' },
  { code: 'ESVLC', name: 'Valencia', country: 'Spain' },
  { code: 'ITGOA', name: 'Genoa', country: 'Italy' },
  { code: 'EGPSD', name: 'Port Said', country: 'Egypt' },
  { code: 'EGSUZ', name: 'Suez', country: 'Egypt' },
  { code: 'SGSIN', name: 'Singapore', country: 'Singapore' },
  { code: 'CNSHA', name: 'Shanghai', country: 'China' },
  { code: 'CNYAS', name: 'Yangshan', country: 'China' },
  { code: 'AEJEA', name: 'Jebel Ali', country: 'United Arab Emirates' },
  { code: 'AEFJR', name: 'Fujairah', country: 'United Arab Emirates' },
  { code: 'USNYC', name: 'New York', country: 'United States' },
  { code: 'USHOU', name: 'Houston', country: 'United States' },
  { code: 'BRSSZ', name: 'Santos', country: 'Brazil' },
  { code: 'ZADUR', name: 'Durban', country: 'South Africa' },
];

// Canals reported as Intermediate Points of Interest (manual §3.2.6).
export const CANALS = ['Suez Canal', 'Panama Canal', 'Kiel Canal', 'Bosphorus'];

export function portLabel(code: string): string {
  const p = PORTS.find((x) => x.code === code);
  return p ? `${p.code} — ${p.name}` : code;
}
