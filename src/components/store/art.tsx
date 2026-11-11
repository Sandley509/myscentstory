import Image from 'next/image';

/**
 * Placeholder banner artwork: generic bottles on a dark stage.
 * Swap for real campaign photography by replacing the files in /public/art
 * or passing a collection image from the admin.
 */
const STAGE = [
  { src: '/art/bottle-4.svg', className: 'left-[4%] h-[62%]' },
  { src: '/art/bottle-1.svg', className: 'left-[24%] h-[88%]' },
  { src: '/art/bottle-2.svg', className: 'left-[50%] h-[70%]' },
  { src: '/art/bottle-3.svg', className: 'left-[70%] h-[54%]' }
];

export function BottleStage({ className = '', count = 4 }: { className?: string; count?: number }) {
  return (
    <div aria-hidden className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-x-[4%] bottom-[9%] h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[9%] bg-gradient-to-b from-accent/25 to-transparent blur-md" />
      {STAGE.slice(0, count).map((b) => (
        <Image
          key={b.src}
          src={b.src}
          alt=""
          width={600}
          height={600}
          className={`absolute bottom-[3%] w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)] ${b.className}`}
        />
      ))}
    </div>
  );
}

export const STAGE_BG = 'bg-[radial-gradient(120%_140%_at_15%_0%,#4a0d3a_0%,#1a0614_50%,#000_100%)]';
