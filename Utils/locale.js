export const COUNTRY_TO_LANG = {
  NL: 'nl',
  EN: 'en',
  FR: 'fr',
  DE: 'de'
};


export function getLangCode(country) {
  return COUNTRY_TO_LANG[country ?? 'US'] ?? 'en';
}