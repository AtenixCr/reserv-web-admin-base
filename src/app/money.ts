export function displayMoney(amount: string, currency: string, locale: string, rate?: string): string {
  const scaled = (text: string, places: number): bigint => {
    const [whole, fraction = ''] = text.split('.');
    return BigInt(whole) * (10n ** BigInt(places)) + BigInt(fraction.padEnd(places,'0').slice(0,places));
  };
  let cents = scaled(amount,2);
  if (rate) cents = (cents * scaled(rate,8) + 50000000n) / 100000000n;
  const parts = new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(cents / 100n);
  return parts.map(part => part.type === 'fraction' ? (cents % 100n).toString().padStart(2,'0') : part.value).join('');
}
