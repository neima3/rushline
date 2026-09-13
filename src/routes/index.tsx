import { createFileRoute } from "@tanstack/react-router";
import { Rushline } from "@/components/game/Rushline";
import { AppErrorComponent } from "@/lib/error-component";

export const Route = createFileRoute("/")({
  component: Home,
  errorComponent: AppErrorComponent,
});

function Home() {
  return <Rushline />;
}
