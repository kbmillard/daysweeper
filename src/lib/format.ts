export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch (_err) {
    return '';
  }
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'USD'
) {
  if (amount === null || amount === undefined) return '';
  
  try {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(num);
  } catch (_err) {
    return '';
  }
}
