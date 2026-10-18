import AndroidIcon from "@mui/icons-material/Android";
import AppleIcon from "@mui/icons-material/Apple";
import ComputerIcon from "@mui/icons-material/Computer";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalConfig } from "../../GlobalContext";
import { GameResponse } from "../../utils/InterFace";
interface ContentProps {
  games: GameResponse["data"]["games"] | null;
  hotGames: GameResponse["data"]["hot_games"] | null;
  selectedCategory: string; // 來自父層的篩選條件
}
const Content: React.FC<ContentProps> = ({
  games,
  hotGames
}) => {
  const {
    config
  } = useGlobalConfig();
  const {
    setting
  } = config;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const firstGame = hotGames ? hotGames[0] : null;
  const {
    t
  } = useTranslation();
  const handleRefreshScroll = () => {
    if (window.scrollY === 0 && !isRefreshing) {
      setIsRefreshing(true);
      refreshPage();
    }
  };
  const refreshPage = () => {
    setTimeout(() => {
      setIsRefreshing(false);
    }, 2000);
  };
  useEffect(() => {
    window.addEventListener("scroll", handleRefreshScroll);
    return () => {
      window.removeEventListener("scroll", handleRefreshScroll);
    };
  }, [isRefreshing]);

  // 建立icon對造表
  const deviceIcons: Record<string, JSX.Element> = {
    Android: <AndroidIcon className="w-5 h-5 text-gray-400" />,
    iOS: <AppleIcon className="w-5 h-5 text-gray-400" />,
    PC: <ComputerIcon className="w-5 h-5 text-gray-400" />
  };
  return <>
      <div className="w-full  dark:bg-bbk">
        <p className="p-2 text-lg dark:text-white">{t("games.game_rank")}</p>
        {/* 上方區塊：前6筆資料 */}
        <div className="flex flex-wrap ">
          <a className="w-full p-3 relative" href={firstGame?.link?.startsWith("http") ? firstGame.link : setting.main_web_host} target="_blank" rel="noopener noreferrer">
            <p className="absolute top-3 left-6 bg-[#ff0000ee] text-white h-8 w-8 z-10 flex items-center justify-center">
              1
            </p>
            <div className="aspect-[2/1] overflow-hidden">
              <img src={firstGame?.photo && setting?.img_host ? `${setting.img_host}${firstGame.photo}` : "/images/title-circle.webp"} alt={firstGame?.title || "game"} loading="lazy" decoding="async" className="w-full h-full rounded-lg object-cover bg-gy" />
            </div>
            <div className="flex justify-between">
              <p className=" line-clamp-1 ">{firstGame?.title}</p>
              <span className="flex gap-2 ">
                {firstGame?.type?.map((item, index) => <span key={index}>{deviceIcons[item]}</span>)}
              </span>
            </div>
            <p className="text-og">{firstGame?.categories.name}</p>
            <p className="line-clamp-1 text-gray-400"> {firstGame?.description}</p>
          </a>
        </div>
        <div className="overflow-x-auto flex gap-7 p-3 scrollbar-hidden">
          {hotGames?.slice(1, 6).map((item, index) => <a href={item.link.startsWith("http") ? item.link : setting.main_web_host} key={index} target="_blank" rel="noopener noreferrer" className="min-w-[60%] relative">
              <p className={`absolute top-0 left-3 h-8 w-8 z-10 flex items-center justify-center text-white ${index === 0 ? "bg-orange-500" : index === 1 ? "bg-green-500" : "bg-gray-700"} `}>
                {index + 2}
              </p>
              <div className="aspect-[2/1] overflow-hidden">
                <img src={item?.photo && setting?.img_host ? `${setting.img_host}${item.photo}` : "/images/title-circle.webp"} alt={item?.title || "image"} loading="lazy" decoding="async" className="w-full h-full rounded-lg object-cover bg-gy" />
              </div>

              <div className="flex justify-between">
                <p className=" line-clamp-1 dark:text-white">{item.title}</p>
                <span className="flex gap-2 ">
                  {item?.type?.map((item, index) => <span key={index}>{deviceIcons[item]}</span>)}
                </span>
              </div>
              <p className="text-og">{item.categories.name}</p>
              <p className="line-clamp-1 text-gray-400"> {item.description}</p>
            </a>)}
        </div>

        <p className="p-2 text-lg dark:text-white dark:bg-nbk">{t("games.all_games")}</p>
        {/* 下方區塊 */}
        <div className="grid grid-cols-1 gap-3 mt-2 px-3 pb-20">
          {games?.map(item => <a key={item.gid} className="w-full mb-3" href={item.link.startsWith("http") ? item.link : setting.main_web_host} target="_blank" rel="noopener noreferrer">
              <div className="aspect-[2/1] overflow-hidden block">
                <img src={item?.photo && setting?.img_host ? `${setting.img_host}${item.photo}` : "/images/title-circle.webp"} alt={item?.title || "image"} loading="lazy" decoding="async" className="w-full h-full rounded-lg object-cover bg-gy" />
              </div>
              <div className="flex justify-between">
                <p className=" line-clamp-1 dark:text-white">{item.title}</p>
                <span className="flex gap-2 ">
                  {item?.type?.map((item, index) => <span key={index}>{deviceIcons[item]}</span>)}
                </span>
              </div>
              <p className="text-og">{item.categories.name}</p>
              <p className="line-clamp-1 text-gray-400">{item.description}</p>
            </a>)}
        </div>
      </div>
    </>;
};
export default Content;
