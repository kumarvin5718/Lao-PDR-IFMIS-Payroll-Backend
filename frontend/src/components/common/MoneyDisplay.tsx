interface MoneyDisplayProps {
  amount: number;
  currency?: string;
}

export function MoneyDisplay({ amount, currency = "LAK" }: MoneyDisplayProps) {
  const formatted = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ${currency}`;
}
