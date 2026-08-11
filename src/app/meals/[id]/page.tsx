import { notFound } from "next/navigation";
import { getMealById } from "@/lib/services/meals";
import { MealDetailClient } from "@/components/meals/MealDetailClient";

export const dynamic = "force-dynamic";

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meal = await getMealById(id);
  if (!meal) notFound();

  return <MealDetailClient meal={meal} />;
}
