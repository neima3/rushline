import { createFileRoute } from "@tanstack/react-router";
import { Rushline } from "@/components/game/Rushline";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <Rushline />;
}
