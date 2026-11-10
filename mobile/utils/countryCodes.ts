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

/** Used when the device region is missing or not in the supported list. */
const FALLBACK_COUNTRY = countryCodes[0]; // United States

type DeviceLocale = {
  regionCode?: string | null;
  languageTag?: string | null;
};

type LocaleReader = () => DeviceLocale[];

/**
 * Soft-bind expo-localization so Deno unit tests can load this module
 * without the native Expo package. Same pattern as currency.ts.
 */
let readLocales: LocaleReader | null = null;
try {
  // Soft native dependency — documented exception to top-level-only imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Localization = require("expo-localization") as {
    getLocales?: LocaleReader;
  };
  readLocales = Localization.getLocales ?? null;
} catch {
  readLocales = null;
}

function regionFromLanguageTag(
  languageTag: string | null | undefined,
): string | null {
  if (!languageTag) return null;
  const subtags = languageTag.replace(/_/g, "-").split("-");
  // Skip the primary language subtag. Region is a later 2-letter subtag
  // (en-IN, zh-Hans-CN). Script subtags are 4 letters and are ignored.
  for (let index = subtags.length - 1; index >= 1; index -= 1) {
    const subtag = subtags[index];
    if (/^[A-Za-z]{2}$/.test(subtag)) return subtag;
  }
  return null;
}

/**
 * Pick a supported phone country from device locale data.
 * An explicit regionCode wins. Otherwise the region is read from languageTag.
 * Unknown or missing regions fall back to the United States.
 */
export function countryFromDeviceLocales(
  locales: ReadonlyArray<DeviceLocale> | null | undefined,
): CountryCode {
  const primary = locales?.[0];
  const explicitRegion = primary?.regionCode?.trim();
  if (explicitRegion) {
    return getCountryByCode(explicitRegion) ?? FALLBACK_COUNTRY;
  }
  const tagRegion = regionFromLanguageTag(primary?.languageTag);
  if (tagRegion) {
    return getCountryByCode(tagRegion) ?? FALLBACK_COUNTRY;
  }
  return FALLBACK_COUNTRY;
}

/**
 * Default phone country for an empty profile field.
 * Reads the device region (expo-localization) and falls back to the US.
 * Does not read or store the phone number.
 */
export const getDefaultCountry = (): CountryCode => {
  try {
    return countryFromDeviceLocales(readLocales?.() ?? null);
  } catch {
    return FALLBACK_COUNTRY;
  }
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
  // A stored number with no dial prefix stays on the US fallback.
  // Using the device region here would change the formatted value in the
  // editor and could rewrite the saved number the next time the profile is saved.
  return {
    countryCode: FALLBACK_COUNTRY.dialCode,
    number: phoneNumber,
    possibleCountries: [FALLBACK_COUNTRY],
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

