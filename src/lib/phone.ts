export function normalizeCameroonPhone(value: string | null | undefined): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00237')) digits = digits.slice(5);
  if (digits.startsWith('237') && digits.length > 3) digits = digits.slice(3);
  return digits;
}

export function displayCameroonPhone(value: string | null | undefined): string {
  const digits = normalizeCameroonPhone(value);
  if (!digits) return '';
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export function phoneForWhatsapp(value: string | null | undefined): string {
  const digits = normalizeCameroonPhone(value);
  if (!digits) return '';
  return digits.length === 9 ? `237${digits}` : digits;
}

export function phoneForTel(value: string | null | undefined): string {
  const digits = normalizeCameroonPhone(value);
  return digits || '';
}
