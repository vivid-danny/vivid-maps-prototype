import { SeatMapRoot } from './seatMap/components/SeatMapRoot';
import { Agentation } from "agentation";

export default function App() {
  return (
    <>
      <SeatMapRoot />
      {import.meta.env.DEV ? <Agentation /> : null}
    </>
  );
}
