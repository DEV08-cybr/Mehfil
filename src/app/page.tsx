import MehfilPlayer from "@/components/MehfilPlayer";

export default function HomePage() {
  return (
    <>
      {/* Full-bleed MEHFIL sign background */}
      <div className="bg-full" aria-hidden />
      <div className="bg-veil" aria-hidden />
      <MehfilPlayer />
    </>
  );
}