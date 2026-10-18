import { SymbolView } from "@/components/markets/symbol-view";

export default async function SymbolPage({ params }: PageProps<"/markets/[symbol]">) {
  const { symbol } = await params;
  return <SymbolView symbol={decodeURIComponent(symbol).toUpperCase()} />;
}
