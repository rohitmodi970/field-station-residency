"use client"
import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import OrganicBackground from "./OrganicBackground";
// --- Components ---

export  const Logo = () => (
  <svg
    width="206"
    height="156"
    viewBox="0 0 206 156"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    // Adjusted sizing for footer usage while maintaining aspect ratio
    className="mb-6 h-10 w-auto sm:h-12"
  >
    <path
      d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z"
      fill="white"
      stroke="white"
      strokeWidth="11.6841"
    />
    <path
      d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z"
      fill="white"
      stroke="white"
      strokeWidth="11.6841"
    />
    <path
      d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z"
      fill="white"
      stroke="white"
      strokeWidth="11.6841"
    />
    <path
      d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z"
      fill="white"
      stroke="white"
      strokeWidth="11.6841"
    />
  </svg>
);

export default function Organic() {
  const router = useRouter();

  const handleJoinWaitlist = () => {
    router.push('/waitlist');
  };

  return (
    <div className="relative min-h-[250vh] bg-[#e6dede] overflow-hidden flex flex-col justify-between">
      <OrganicBackground />

      {/* Main Content Area - Pushed to bottom to sit on 'hills' */}
      <main className="relative z-10 flex-grow flex flex-col justify-end pb-20 sm:pb-32">
        <section
          id="hero"
          className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl text-center"
        >
          <div className="w-full mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="font-terminal-grotesque text-white text-[clamp(32px,6vw,64px)] tracking-tight leading-[1.1] mb-4 sm:mb-6"
              style={{ textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}
            >
              RETURN TO YOURSELF.
              <br />
              RECLAIM YOUR ATTENTION.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="font-terminal-grotesque text-white/80 text-[clamp(14px,3vw,18px)] mb-8 sm:mb-12 max-w-xl mx-auto leading-relaxed"
            >
              Join a vibrant, intelligent space designed for deep thinkers in the
              age of AI.
            </motion.p>

            {/* Image Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex justify-center"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoinWaitlist}
                className="group relative touch-manipulation transition-transform duration-200"
                aria-label="Join Waitlist"
              >
                <img
                  src="/landing/Mountain/Button.png"
                  alt=""
                  className="h-[38px] sm:h-[44px] md:h-[50px] lg:h-[56px] w-auto min-w-[150px] sm:min-w-[160px] md:min-w-[176px] cursor-pointer"
                  style={{ imageRendering: "-webkit-optimize-contrast" }}
                />
                <div className="flex items-center justify-center absolute inset-0 text-white font-terminal-grotesque gap-1.5 sm:gap-2 pointer-events-none select-none">
                  <span className="inline-flex items-center justify-center whitespace-nowrap text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] font-medium tracking-wide">
                    JOIN WAITLIST
                  </span>
                  <span className="flex-shrink-0">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 38 38"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-[24px] h-[24px] sm:w-[28px] sm:h-[28px] md:w-[32px] md:h-[32px] lg:w-[36px] lg:h-[36px]"
                    >
                      <circle
                        cx="19"
                        cy="19"
                        r="18.5"
                        stroke="white"
                        strokeWidth="1"
                      />
                      <path
                        d="M16 10L22.5 19L16 28"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </div>
              </motion.button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer Section with Logo */}
      <footer className="relative z-20 w-full py-8 sm:py-12 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 to-transparent">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="flex flex-col items-center"
        >
          <Logo />
          <p className="font-terminal-grotesque text-white/50 text-xs sm:text-sm tracking-wide">
            © 2026 Force. All rights reserved.
          </p>
          <div className="flex items-center gap-4 mt-1">
            <a href="/terms-and-conditions" className="font-terminal-grotesque text-white/40 hover:text-white/70 text-xs sm:text-sm tracking-wide transition-colors">
              Terms
            </a>
            <span className="text-white/30 text-xs">·</span>
            <a href="/privacy-policy" className="font-terminal-grotesque text-white/40 hover:text-white/70 text-xs sm:text-sm tracking-wide transition-colors">
              Privacy Policy
            </a>
          </div>
        </motion.div>
      </footer>
    </div>
  );
}

// --- Background Component (Unchanged) ---

// function OrganicBackground() {
//   return (
//     <div className="absolute inset-0 overflow-hidden pointer-events-none">
//       <svg
//         className="absolute w-full h-full min-w-[120%] min-h-[120%] -left-[10%] top-0 object-cover"
//         viewBox="0 0 1728 1813"
//         fill="none"
//         xmlns="http://www.w3.org/2000/svg"
//         preserveAspectRatio="xMidYMid slice"
//       >
//         <defs>
//           <filter
//             id="filter0_f_organic"
//             x="-444.678"
//             y="0.000228882"
//             width="2581.07"
//             height="1812.32"
//             filterUnits="userSpaceOnUse"
//             colorInterpolationFilters="sRGB"
//           >
//             <feFlood floodOpacity="0" result="BackgroundImageFix" />
//             <feBlend
//               mode="normal"
//               in="SourceGraphic"
//               in2="BackgroundImageFix"
//               result="shape"
//             />
//             <feGaussianBlur
//               stdDeviation="95.8388"
//               result="effect1_foregroundBlur"
//             />
//           </filter>
//           <filter
//             id="filter1_f_organic"
//             x="-407.701"
//             y="288.602"
//             width="2581.18"
//             height="1486.23"
//             filterUnits="userSpaceOnUse"
//             colorInterpolationFilters="sRGB"
//           >
//             <feFlood floodOpacity="0" result="BackgroundImageFix" />
//             <feBlend
//               mode="normal"
//               in="SourceGraphic"
//               in2="BackgroundImageFix"
//               result="shape"
//             />
//             <feGaussianBlur
//               stdDeviation="95.8388"
//               result="effect1_foregroundBlur"
//             />
//           </filter>
//           <filter
//             id="filter2_f_organic"
//             x="-407.701"
//             y="684.471"
//             width="2581.18"
//             height="1128.02"
//             filterUnits="userSpaceOnUse"
//             colorInterpolationFilters="sRGB"
//           >
//             <feFlood floodOpacity="0" result="BackgroundImageFix" />
//             <feBlend
//               mode="normal"
//               in="SourceGraphic"
//               in2="BackgroundImageFix"
//               result="shape"
//             />
//             <feGaussianBlur
//               stdDeviation="95.8388"
//               result="effect1_foregroundBlur"
//             />
//           </filter>
//           <linearGradient
//             id="paint0_linear_organic"
//             x1="845.857"
//             y1="191.678"
//             x2="845.857"
//             y2="1620.64"
//             gradientUnits="userSpaceOnUse"
//           >
//             <stop stopColor="#536A0D" />
//             <stop offset="1" stopColor="#191C01" />
//           </linearGradient>
//           <linearGradient
//             id="paint1_linear_organic"
//             x1="882.887"
//             y1="480.279"
//             x2="882.887"
//             y2="1583.16"
//             gradientUnits="userSpaceOnUse"
//           >
//             <stop stopColor="#04352D" />
//             <stop offset="1" stopColor="#191C01" />
//           </linearGradient>
//           <linearGradient
//             id="paint2_linear_organic"
//             x1="882.887"
//             y1="876.148"
//             x2="882.887"
//             y2="1620.82"
//             gradientUnits="userSpaceOnUse"
//           >
//             <stop stopColor="#191C01" />
//             <stop offset="1" />
//           </linearGradient>
//         </defs>
//         <g filter="url(#filter0_f_organic)">
//           <path
//             d="M114.758 1017.55C8.51663 1175.73 -152.548 1485.52 -253 1620.64C495.498 1620.64 1982.79 1615.51 1943.97 1594.99C1895.45 1569.35 1649 1098.62 1584.51 1017.55C1520.03 936.478 1398.44 607.396 1313 483.718C1231.28 365.412 953.705 189.763 854.104 191.694C752.588 194.175 462.085 371.208 395.045 483.718C345.523 566.829 247.559 819.831 114.758 1017.55Z"
//             fill="url(#paint0_linear_organic)"
//           />
//         </g>
//         <g filter="url(#filter1_f_organic)">
//           <path
//             d="M151.752 1117.69C45.5059 1239.77 -115.566 1478.87 -216.023 1583.16C532.511 1583.16 2019.87 1579.2 1981.05 1563.36C1932.53 1543.57 1686.07 1180.27 1621.58 1117.69C1557.09 1055.12 1412.67 801.133 1327.23 705.677C1245.5 614.369 990.74 478.802 891.134 480.291C789.613 482.207 499.096 618.841 432.053 705.677C382.529 769.823 284.56 965.091 151.752 1117.69Z"
//             fill="url(#paint1_linear_organic)"
//           />
//         </g>
//         <g filter="url(#filter2_f_organic)">
//           <path
//             d="M218.156 1155.35C111.91 1277.43 -115.566 1516.53 -216.023 1620.82C532.511 1620.82 2019.87 1616.86 1981.05 1601.02C1932.53 1581.23 1620.3 1217.92 1555.81 1155.35C1491.32 1092.78 1374.48 974.016 1256.99 922.936C1163.01 882.073 940.299 874.836 840.693 876.326C739.172 878.242 581.462 900.589 503.565 922.936C425.668 945.284 350.964 1002.75 218.156 1155.35Z"
//             fill="url(#paint2_linear_organic)"
//           />
//         </g>
//       </svg>
//     </div>
//   );
// }