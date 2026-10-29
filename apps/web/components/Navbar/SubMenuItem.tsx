import Link from 'next/link';
import { motion } from 'framer-motion';
import { HiHome, HiUser, HiMail, HiDocumentText, HiSun, HiMoon, HiLogin, HiLogout, HiArchive, HiOutlineChip, HiChevronRight, HiPhotograph, HiViewGrid, HiPencilAlt, HiChartBar, HiDocumentSearch, HiDocumentReport, HiCollection, HiChartPie, HiPresentationChartLine, HiEmojiHappy, HiMicrophone, HiVolumeUp, HiAdjustments, HiCog } from "react-icons/hi";
import { GiNotebook } from "react-icons/gi";
import { GrUserSettings } from "react-icons/gr";
import { ColorOption } from "../../utilities/context/ThemeContext";
interface SubMenuItemProps {
  item: {
    name: string;
    href: string;
    icon: string;
  };
  isActive: boolean;
  currentTheme: ColorOption;
  isDarkMode: boolean;
  onClick?: () => void;
}

const ICON_MAP = {
  HiHome: (size: number) => <HiHome size={size} />,
  HiUser: (size: number) => <HiUser size={size} />,
  HiMail: (size: number) => <HiMail size={size} />,
  HiDocumentText: (size: number) => <HiDocumentText size={size} />,
  HiArchive: (size: number) => <HiArchive size={size} />,
  HiOutlineChip: (size: number) => <HiOutlineChip size={size} />,
  GiNotebook: (size: number) => <GiNotebook size={size} />,
  GrUserSettings: (size: number) => <GrUserSettings size={size} />,
  HiPhotograph: (size: number) => <HiPhotograph size={size} />,
  HiViewGrid: (size: number) => <HiViewGrid size={size} />,
  HiPencilAlt: (size: number) => <HiPencilAlt size={size} />,
  HiChartBar: (size: number) => <HiChartBar size={size} />,
  HiCog: (size: number) => <HiCog size={size} />,
  HiDocumentSearch: (size: number) => <HiDocumentSearch size={size} />,
  HiDocumentReport: (size: number) => <HiDocumentReport size={size} />,
  HiCollection: (size: number) => <HiCollection size={size} />,
  HiChartPie: (size: number) => <HiChartPie size={size} />,
  HiPresentationChartLine: (size: number) => <HiPresentationChartLine size={size} />,
  HiEmojiHappy: (size: number) => <HiEmojiHappy size={size} />,
  HiMicrophone: (size: number) => <HiMicrophone size={size} />,
  HiVolumeUp: (size: number) => <HiVolumeUp size={size} />,
  HiAdjustments: (size: number) => <HiAdjustments size={size} />
};
const getIcon = (iconName: string, size = 24) => {
  return ICON_MAP[iconName as keyof typeof ICON_MAP]?.(size) || <HiHome size={size} />;
};
const SubMenuItem: React.FC<SubMenuItemProps> = ({ item, isActive, currentTheme, isDarkMode, onClick }) => {
  return (
    <Link href={item.href} passHref>
      <motion.div
        className={`flex items-center w-full p-2 pl-11 text-base transition-all duration-100 rounded-lg ${
          !isActive ? (isDarkMode ? "hover:bg-gray-700/20" : "hover:bg-gray-100/80") : ""
        }`}
        style={{ 
          color: isActive ? currentTheme.primary : (isDarkMode ? "#e5e7eb" : "#374151"),
          backgroundColor: isActive 
            ? (isDarkMode ? `${currentTheme.primary}20` : `${currentTheme.primary}10`) 
            : undefined
        }}
        whileHover={{ x: 5 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        onClick={onClick}
        role="menuitem"
        aria-current={isActive ? "page" : undefined}
      >
        <span>{getIcon(item.icon, 18)}</span>
        <span className="ml-2">{item.name}</span>
      </motion.div>
    </Link>
  );
};
export default SubMenuItem;