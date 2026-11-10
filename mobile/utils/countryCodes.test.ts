import { assertEquals } from "jsr:@std/assert@1";
import {
  countryFromDeviceLocales,
  getDefaultCountry,
  parsePhoneNumber,
} from "./countryCodes.ts";

Deno.test("device region selects that phone country, including shared dial codes", () => {
  assertEquals(countryFromDeviceLocales([{ regionCode: "IN" }]).code, "IN");
  assertEquals(countryFromDeviceLocales([{ regionCode: "in" }]).dialCode, "+91");
  assertEquals(countryFromDeviceLocales([{ regionCode: " gb " }]).code, "GB");
  // +1 is shared with the US; an explicit CA region must not collapse to US.
  assertEquals(countryFromDeviceLocales([{ regionCode: "CA" }]).code, "CA");
  assertEquals(
    countryFromDeviceLocales([
      { regionCode: "IN" },
      { regionCode: "US" },
    ]).code,
    "IN",
  );
});

Deno.test("language tag supplies the region when regionCode is missing", () => {
  assertEquals(
    countryFromDeviceLocales([{ regionCode: "", languageTag: "en-IN" }]).code,
    "IN",
  );
  assertEquals(
    countryFromDeviceLocales([{ languageTag: "zh-Hans-CN" }]).code,
    "CN",
  );
  assertEquals(
    countryFromDeviceLocales([{ languageTag: "en_GB" }]).code,
    "GB",
  );
  assertEquals(
    countryFromDeviceLocales([{ languageTag: "pt-BR" }]).dialCode,
    "+55",
  );
});

Deno.test("unknown or missing locale falls back to the United States", () => {
  assertEquals(countryFromDeviceLocales(null).code, "US");
  assertEquals(countryFromDeviceLocales([]).code, "US");
  assertEquals(countryFromDeviceLocales([{ regionCode: "ZZ" }]).code, "US");
  assertEquals(
    countryFromDeviceLocales([{ languageTag: "en" }]).code,
    "US",
  );
  assertEquals(
    countryFromDeviceLocales([{ languageTag: "es-419" }]).code,
    "US",
  );
  // An explicit unknown region is not replaced by a language-tag country.
  assertEquals(
    countryFromDeviceLocales([{ regionCode: "ZZ", languageTag: "en-IN" }]).code,
    "US",
  );
});

Deno.test("an entered dial code is kept and a bare national number stays on US", () => {
  const india = parsePhoneNumber("+919876543210");
  assertEquals(india.countryCode, "+91");
  assertEquals(india.number, "9876543210");
  assertEquals(india.possibleCountries.map((country) => country.code), ["IN"]);

  const canada = parsePhoneNumber("+14165550100");
  assertEquals(canada.countryCode, "+1");
  assertEquals(
    canada.possibleCountries.map((country) => country.code),
    ["US", "CA"],
  );

  const national = parsePhoneNumber("9876543210");
  assertEquals(national.countryCode, "+1");
  assertEquals(national.number, "9876543210");
  assertEquals(national.possibleCountries.map((country) => country.code), ["US"]);
});

Deno.test("getDefaultCountry falls back to US when device locales are unavailable", () => {
  // Deno does not load expo-localization, so this is the no-locale path.
  const country = getDefaultCountry();
  assertEquals(country.code, "US");
  assertEquals(country.dialCode, "+1");
});
