import { cn } from "@/lib/utils";
import { useRef, useState, useLayoutEffect } from "react";
import gsap from "gsap";

// Crossword grid constants — 6×6 cells at 70px each, 6px gap, 25px padding
// Total grid: 6×70 + 5×6 = 450px → 25px margins in 500px viewBox
const CW_CELL   = 70;
const CW_STEP   = 76;  // cell + gap
const CW_OFFSET = 25;
const CW_COLS   = 6;
const CW_ROWS   = 6;

// 0 = black square (absent), 1 = white square (image shows through)
// All patterns have 180° rotational symmetry — authentic crossword style

// Board Gameplay — classic scatter
const GRID_BOARD = [
  [1,1,1,0,1,1],
  [1,0,1,1,1,1],
  [1,1,1,1,0,1],
  [1,0,1,1,1,1],
  [1,1,1,1,0,1],
  [1,1,0,1,1,1],
];

// Dark Mode — corner anchors
const GRID_DARK = [
  [0,1,1,1,1,0],
  [1,1,1,1,1,1],
  [1,1,1,0,1,1],
  [1,1,0,1,1,1],
  [1,1,1,1,1,1],
  [0,1,1,1,1,0],
];

// Letter Panel — diagonal drift
const GRID_LETTER = [
  [1,0,1,1,1,1],
  [1,1,1,1,0,1],
  [1,1,0,1,1,1],
  [1,1,1,0,1,1],
  [1,0,1,1,1,1],
  [1,1,1,1,0,1],
];

// Bot Setup — edge clusters
const GRID_BOT = [
  [1,1,0,1,1,0],
  [1,1,1,0,1,1],
  [1,1,1,1,1,1],
  [1,1,1,1,1,1],
  [1,1,0,1,1,1],
  [0,1,1,0,1,1],
];

function makeCrosswordClip(id: string, grid: number[][]) {
  const rects: React.ReactElement[] = [];
  for (let r = 0; r < CW_ROWS; r++) {
    for (let c = 0; c < CW_COLS; c++) {
      if (grid[r][c] === 1) {
        rects.push(
          <rect
            key={`${c}-${r}`}
            className="path"
            x={CW_OFFSET + c * CW_STEP}
            y={CW_OFFSET + r * CW_STEP}
            width={CW_CELL}
            height={CW_CELL}
            rx="6"
          />
        );
      }
    }
  }
  return <clipPath id={id}>{rects}</clipPath>;
}

interface MenuItem {
  num: string;
  name: string;
  clipId: string;
  image: string;
}

const defaultItems: MenuItem[] = [
  {
    num: "01",
    name: "Board Gameplay",
    clipId: "clip-original",
    image: "/assets/screenshots/board-gameplay.jpg"
  },
  {
    num: "02",
    name: "Dark Mode",
    clipId: "clip-hexagons",
    image: "/assets/screenshots/dark-mode-bot.jpg"
  },
  {
    num: "03",
    name: "Letter Panel",
    clipId: "clip-pixels",
    image: "/assets/screenshots/alphabet-panel.jpg"
  },
  {
    num: "04",
    name: "Bot Setup",
    clipId: "clip-diamonds",
    image: "/assets/screenshots/bot-setup.jpg"
  }
];

export const Component = ({
  items = defaultItems,
  className
}: { items?: MenuItem[]; className?: string }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<SVGImageElement>(null);
  const mainGroupRef = useRef<SVGGElement>(null);
  const masterTl = useRef<gsap.core.Timeline | null>(null);

  const createLoop = (index: number) => {
    const item = items[index];
    const selector = `#${item.clipId} .path`;

    if (masterTl.current) masterTl.current.kill();
    if (imageRef.current) imageRef.current.setAttribute("href", item.image);
    if (mainGroupRef.current) mainGroupRef.current.setAttribute("clip-path", `url(#${item.clipId})`);

    gsap.set(selector, { scale: 0, opacity: 0, transformOrigin: "50% 50%" });

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.5 });

    // 1. IN — slow cinematic fade + scale from random
    tl.to(selector, {
      scale: 1,
      opacity: 1,
      duration: 1.5,
      stagger: { amount: 1.0, from: "random" },
      ease: "expo.out",
    })
    // 2. IDLE — gentle breath
    .to(selector, {
      scale: 1.03,
      duration: 2.5,
      yoyo: true,
      repeat: 1,
      ease: "sine.inOut",
      stagger: { amount: 0.4, from: "center" }
    })
    // 3. OUT — drift away
    .to(selector, {
      scale: 0,
      opacity: 0,
      duration: 1.0,
      stagger: { amount: 0.6, from: "edges" },
      ease: "expo.in",
    });

    masterTl.current = tl;
  };

  // Fixed: no gsap.context wrapper — masterTl handles cleanup consistently
  // for both initial and subsequent createLoop calls
  useLayoutEffect(() => {
    createLoop(0);
    return () => { masterTl.current?.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleItemHover = (index: number) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
    createLoop(index);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col md:flex-row items-center justify-between min-h-screen w-full p-8 md:p-24 overflow-hidden transition-colors duration-500",
        "bg-white dark:bg-[#050505]",
        className
      )}
    >

      {/* LEFT SIDE: HIGH CONTRAST MENU */}
      <div className="z-20 w-full md:w-1/2">
        <nav>
          <ul className="flex flex-col gap-14">
            {items.map((item, index) => (
              <li
                key={item.num}
                onMouseEnter={() => handleItemHover(index)}
                className="group cursor-pointer"
              >
                <div className="flex items-start gap-6">
                  {/* Numbers */}
                  <span className={cn(
                    "text-3xl font-bold transition-all duration-500 mt-2",
                    activeIndex === index
                      ? "text-orange-500 scale-110"
                      : "text-zinc-400 dark:text-zinc-600"
                  )}>
                    {item.num}
                  </span>

                  {/* Main Text */}
                  <h2 className={cn(
                    "text-5xl md:text-6xl font-black uppercase tracking-tighter leading-[0.85] transition-all duration-700",
                    activeIndex === index
                      ? "text-zinc-950 dark:text-white opacity-100 translate-x-4"
                      : "opacity-40 translate-x-0 " +
                        "text-zinc-500 dark:text-transparent " +
                        "dark:[text-stroke:1.5px_#52525b] dark:[-webkit-text-stroke:1.5px_#52525b]"
                  )}>
                    {item.name.split(' ')[0]}<br />
                    {item.name.split(' ')[1]}
                  </h2>
                </div>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* RIGHT SIDE: SVG CLIP PATH ANIMATION */}
      <div className="relative w-full md:w-1/2 flex justify-center items-center mt-16 md:mt-0">
        <div className="absolute w-[120%] h-[120%] bg-orange-500/10 dark:bg-orange-600/5 blur-[120px] rounded-full transition-opacity duration-1000" />

        <svg viewBox="0 0 500 500" className="w-[100%] max-w-[500px] h-auto z-10 drop-shadow-xl dark:drop-shadow-[0_0_60px_rgba(0,0,0,0.8)]">
          <defs>
            {makeCrosswordClip("clip-original", GRID_BOARD)}
            {makeCrosswordClip("clip-hexagons", GRID_DARK)}
            {makeCrosswordClip("clip-pixels",   GRID_LETTER)}
            {makeCrosswordClip("clip-diamonds",  GRID_BOT)}
          </defs>

          <g ref={mainGroupRef} clipPath={`url(#${items[0].clipId})`}>
            <image
              ref={imageRef}
              href={items[0].image}
              width="500"
              height="500"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};
