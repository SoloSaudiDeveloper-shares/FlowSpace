import { getRecentElements, getFavoriteElements } from "@/lib/actions/element-actions"
import { HomeContent } from "@/components/home/home-content"

export default async function HomePage() {
  const [recentElements, favorites] = await Promise.all([
    getRecentElements(20),
    getFavoriteElements(),
  ])

  return <HomeContent recentElements={recentElements} favorites={favorites} />
}
