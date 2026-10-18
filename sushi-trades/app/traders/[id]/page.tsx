import { TraderView } from "@/components/traders/trader-view";

export default async function TraderPage({ params }: PageProps<"/traders/[id]">) {
  const { id } = await params;
  return <TraderView traderId={decodeURIComponent(id).toLowerCase()} />;
}
