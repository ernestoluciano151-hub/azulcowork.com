// Mapa de timezone → código de país WhatsApp
const TIMEZONE_TO_DIAL: Record<string, { code: string; flag: string; name: string }> = {
  "Africa/Luanda":          { code: "+244", flag: "🇦🇴", name: "Angola" },
  "Africa/Lagos":           { code: "+234", flag: "🇳🇬", name: "Nigéria" },
  "Africa/Nairobi":         { code: "+254", flag: "🇰🇪", name: "Quénia" },
  "Africa/Johannesburg":    { code: "+27",  flag: "🇿🇦", name: "África do Sul" },
  "Africa/Maputo":          { code: "+258", flag: "🇲🇿", name: "Moçambique" },
  "Africa/Abidjan":         { code: "+225", flag: "🇨🇮", name: "Costa do Marfim" },
  "Africa/Accra":           { code: "+233", flag: "🇬🇭", name: "Gana" },
  "Africa/Dakar":           { code: "+221", flag: "🇸🇳", name: "Senegal" },
  "Africa/Casablanca":      { code: "+212", flag: "🇲🇦", name: "Marrocos" },
  "Africa/Cairo":           { code: "+20",  flag: "🇪🇬", name: "Egito" },
  "Africa/Kinshasa":        { code: "+243", flag: "🇨🇩", name: "RD Congo" },
  "Africa/Brazzaville":     { code: "+242", flag: "🇨🇬", name: "Congo" },
  "Africa/Douala":          { code: "+237", flag: "🇨🇲", name: "Camarões" },
  "Africa/Bissau":          { code: "+245", flag: "🇬🇼", name: "Guiné-Bissau" },
  "Atlantic/Cape_Verde":    { code: "+238", flag: "🇨🇻", name: "Cabo Verde" },
  "Africa/Sao_Tome":        { code: "+239", flag: "🇸🇹", name: "S. Tomé e Príncipe" },
  "Europe/Lisbon":          { code: "+351", flag: "🇵🇹", name: "Portugal" },
  "Europe/London":          { code: "+44",  flag: "🇬🇧", name: "Reino Unido" },
  "Europe/Paris":           { code: "+33",  flag: "🇫🇷", name: "França" },
  "Europe/Berlin":          { code: "+49",  flag: "🇩🇪", name: "Alemanha" },
  "Europe/Madrid":          { code: "+34",  flag: "🇪🇸", name: "Espanha" },
  "Europe/Rome":            { code: "+39",  flag: "🇮🇹", name: "Itália" },
  "America/Sao_Paulo":      { code: "+55",  flag: "🇧🇷", name: "Brasil" },
  "America/Fortaleza":      { code: "+55",  flag: "🇧🇷", name: "Brasil" },
  "America/Manaus":         { code: "+55",  flag: "🇧🇷", name: "Brasil" },
  "America/New_York":       { code: "+1",   flag: "🇺🇸", name: "EUA" },
  "America/Los_Angeles":    { code: "+1",   flag: "🇺🇸", name: "EUA" },
  "America/Chicago":        { code: "+1",   flag: "🇺🇸", name: "EUA" },
  "Asia/Dubai":             { code: "+971", flag: "🇦🇪", name: "Emirados" },
  "Asia/Kolkata":           { code: "+91",  flag: "🇮🇳", name: "Índia" },
  "Asia/Shanghai":          { code: "+86",  flag: "🇨🇳", name: "China" },
  "Asia/Tokyo":             { code: "+81",  flag: "🇯🇵", name: "Japão" },
};

export type DialInfo = { code: string; flag: string; name: string };

export function getDialInfoFromTimezone(tz?: string): DialInfo {
  if (!tz) return { code: "+244", flag: "🇦🇴", name: "Angola" };
  if (TIMEZONE_TO_DIAL[tz]) return TIMEZONE_TO_DIAL[tz];
  // fallback por prefixo de continente
  if (tz.startsWith("Africa/")) return { code: "+244", flag: "🇦🇴", name: "Angola" };
  if (tz.startsWith("Europe/")) return { code: "+351", flag: "🇵🇹", name: "Portugal" };
  if (tz.startsWith("America/")) return { code: "+55", flag: "🇧🇷", name: "Brasil" };
  return { code: "+244", flag: "🇦🇴", name: "Angola" };
}
