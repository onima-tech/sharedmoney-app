export interface CountryCode {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
}

// Common country codes with flags (using emoji flags)
export const countryCodes: CountryCode[] = [
  { code: "US", dialCode: "+1", name: "United States", flag: "🇺🇸" },
  { code: "IN", dialCode: "+91", name: "India", flag: "🇮🇳" },
  { code: "GB", dialCode: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", dialCode: "+1", name: "Canada", flag: "🇨🇦" },
  { code: "AU", dialCode: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "DE", dialCode: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "FR", dialCode: "+33", name: "France", flag: "🇫🇷" },
  { code: "IT", dialCode: "+39", name: "Italy", flag: "🇮🇹" },
  { code: "ES", dialCode: "+34", name: "Spain", flag: "🇪🇸" },
  { code: "BR", dialCode: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", dialCode: "+52", name: "Mexico", flag: "🇲🇽" },
  { code: "JP", dialCode: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "CN", dialCode: "+86", name: "China", flag: "🇨🇳" },
  { code: "KR", dialCode: "+82", name: "South Korea", flag: "🇰🇷" },
  { code: "SG", dialCode: "+65", name: "Singapore", flag: "🇸🇬" },
  { code: "AE", dialCode: "+971", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SA", dialCode: "+966", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "ZA", dialCode: "+27", name: "South Africa", flag: "🇿🇦" },
  { code: "NZ", dialCode: "+64", name: "New Zealand", flag: "🇳🇿" },
  { code: "NL", dialCode: "+31", name: "Netherlands", flag: "🇳🇱" },
  { code: "BE", dialCode: "+32", name: "Belgium", flag: "🇧🇪" },
  { code: "CH", dialCode: "+41", name: "Switzerland", flag: "🇨🇭" },
  { code: "AT", dialCode: "+43", name: "Austria", flag: "🇦🇹" },
  { code: "SE", dialCode: "+46", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", dialCode: "+47", name: "Norway", flag: "🇳🇴" },
  { code: "DK", dialCode: "+45", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", dialCode: "+358", name: "Finland", flag: "🇫🇮" },
  { code: "PL", dialCode: "+48", name: "Poland", flag: "🇵🇱" },
  { code: "PT", dialCode: "+351", name: "Portugal", flag: "🇵🇹" },
  { code: "GR", dialCode: "+30", name: "Greece", flag: "🇬🇷" },
  { code: "IE", dialCode: "+353", name: "Ireland", flag: "🇮🇪" },
  { code: "IL", dialCode: "+972", name: "Israel", flag: "🇮🇱" },
  { code: "TR", dialCode: "+90", name: "Turkey", flag: "🇹🇷" },
  { code: "RU", dialCode: "+7", name: "Russia", flag: "🇷🇺" },
  { code: "PK", dialCode: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "BD", dialCode: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "PH", dialCode: "+63", name: "Philippines", flag: "🇵🇭" },
  { code: "TH", dialCode: "+66", name: "Thailand", flag: "🇹🇭" },
  { code: "VN", dialCode: "+84", name: "Vietnam", flag: "🇻🇳" },
  { code: "ID", dialCode: "+62", name: "Indonesia", flag: "🇮🇩" },
  { code: "MY", dialCode: "+60", name: "Malaysia", flag: "🇲🇾" },
  { code: "AR", dialCode: "+54", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", dialCode: "+56", name: "Chile", flag: "🇨🇱" },
  { code: "CO", dialCode: "+57", name: "Colombia", flag: "🇨🇴" },
  { code: "PE", dialCode: "+51", name: "Peru", flag: "🇵🇪" },
  { code: "VE", dialCode: "+58", name: "Venezuela", flag: "🇻🇪" },
  { code: "EG", dialCode: "+20", name: "Egypt", flag: "🇪🇬" },
  { code: "NG", dialCode: "+234", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", dialCode: "+254", name: "Kenya", flag: "🇰🇪" },
  { code: "GH", dialCode: "+233", name: "Ghana", flag: "🇬🇭" },
];

// Get country by ISO country code (e.g., 'US', 'CA', 'IN')
export const getCountryByCode = (code: string): CountryCode | undefined => {
  return countryCodes.find((country) => country.code === code.toUpperCase());
};

// Get all countries with the same dial code (for cases like +1 for US and Canada)
export const getCountriesByDialCode = (dialCode: string): CountryCode[] => {
  return countryCodes.filter((country) => country.dialCode === dialCode);
};

// Get default country (US)
export const getDefaultCountry = (): CountryCode => {
  return countryCodes[0]; // US
};

// Parse phone number to extract country code and number
// Returns the dial code and the remaining number
export const parsePhoneNumber = (
  phoneNumber: string
): { countryCode: string; number: string; possibleCountries: CountryCode[] } => {
  // Check if phone number starts with a country code
  // Sort by dial code length (longer first) to match more specific codes first
  const sortedCountries = [...countryCodes].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );
  
  for (const country of sortedCountries) {
    if (phoneNumber.startsWith(country.dialCode)) {
      const possibleCountries = getCountriesByDialCode(country.dialCode);
      return {
        countryCode: country.dialCode,
        number: phoneNumber.substring(country.dialCode.length).trim(),
        possibleCountries,
      };
    }
  }
  // Default to US if no country code found
  return {
    countryCode: getDefaultCountry().dialCode,
    number: phoneNumber,
    possibleCountries: [getDefaultCountry()],
  };
};

// Format phone number with country code
export const formatPhoneNumber = (
  countryCode: string,
  number: string
): string => {
  if (!number) return "";
  return `${countryCode}${number}`.trim();
};

