import { Capacitor } from "@capacitor/core";
import CloseIcon from "@mui/icons-material/Close";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import ShareIcon from "@mui/icons-material/Share";
import CircularProgress from "@mui/material/CircularProgress";
import { AnimatePresence, motion } from "framer-motion";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Virtual } from "swiper/modules";
import { Swiper, SwiperClass, SwiperSlide } from "swiper/react";
import { FETCH_COMIC_READ_THUNK } from "../../actions/detailAction";
import { FETCH_POST_NOTIFICATIONS_SERTRACK_THUNK } from "../../actions/memberAction";
import PositionedSnackbar, { useSnackbarState } from "../../components/Alert/PositionedSnackbar";
import Comment from "../../components/Comic/Comment";
import ReadNav from "../../components/Comic/ReadNav";
import Series from "../../components/Comic/Series";
import Share from "../../components/Comic/Share";
import HeaderAds from "../../components/Common/HeaderAds";
import Loading from "../../components/Common/Loading";
import DialogModal from "../../components/Modal/DialogModal";
import MemberModal from "../../components/Modal/MemberModal";
import MsgModal from "../../components/Modal/MsgModal";
import { useGlobalConfig } from "../../GlobalContext";
import { GoBack } from "../../Hooks";
import { CLEAR_DETIAL_LIST } from "../../reducers/detailFeature";
import { RESET_FORUM_STATE } from "../../reducers/forumFeature";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { scramble_image } from "../../utils/Function";
import { defaultUserFormData } from "../../utils/InterFace";
import { scrambleLimiter } from "./ConcurrencyLimiter";
const Read = () => {
  const navigate = useNavigate();
  const {
    config,
    setConfig
  } = useGlobalConfig();
  const {
    setting,
    logined,
    memberInfo
  } = config;
  const {
    t
  } = useTranslation();
  const {
    snackbars,
    setSnackbars,
    showSnackbar
  } = useSnackbarState();
  const [dialogOpen, setDialogOpen] = useState({
    readSource: false,
    login: false,
    signUp: false,
    forgot: false,
    newTopic: false,
    folder: false,
    series: false,
    comment: false
  });
  const [isVertical, setIsVertical] = useState(true);
  const [formData, setFormData] = useState(defaultUserFormData);
  const dispatch = useAppDispatch();
  const {
    detailList,
    readList,
    isLoading
  } = useAppSelector(state => state.detail);
  // 整包丟給 Virtuoso 自己虛擬化
  const images = useMemo(() => readList.images ?? [], [readList.images]);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const queryId = searchParams.get("id") as string;
  const readId = searchParams.get("readId") as string;
  const queryEp = searchParams.get("episode") as string;
  const querySubEp = searchParams.get("subEpisode") as string;
  const [readImgSource, setReadImgSource] = useState<any[]>([]);
  const [share, setShare] = useState(false);
  const [closeNav, setCloseNav] = useState(false);
  const [msgOpen, setMsgOpen] = useState({
    detail: false,
    detailDownload: false,
    readTrack: false
  });
  const [changeCurrentPage, setChangeCurrentPage] = useState({
    prev: true,
    next: true
  });
  const [seriesGroups, setSeriesGroups] = useState<any>({
    menus: [],
    episode: Number(queryEp),
    subEpisode: querySubEp,
    currentChapterId: readId
  });
  const [readHistory, setReadHistory] = useState<{
    [comicId: string]: string[];
  }>(() => {
    const historyStored = localStorage.getItem("read");
    return historyStored ? JSON.parse(historyStored) : {};
  });
  const imageCount = Math.max(1, images.length);
  const [scrollProgress, setScrollProgress] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const swiperRef = useRef<any>(null);
  const PREFETCH_AHEAD = 12; // 提前幾頁下載,要 >= RENDER_RANGE
  const RENDER_RANGE = 10; // 進入這個範圍才拼接
  const KEEP_RANGE = 12; // 離開這個範圍才銷毀,比 RENDER_RANGE 寬當緩衝
  const DEBOUNCE_MS = 200; // rangeChanged 防抖時間
  const BOTTOM_RANGE = 300; // 離底部這個範圍內,進度條交給 handleWindowScroll 算
  const VIEWPORT_EXTRA_PX = 1200; // Virtuoso 上下各多掛載的高度,調大=往上捲不閃但 canvas 變多

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [sizeCache, setSizeCache] = useState<Record<number, number>>({});
  const [renderRange, setRenderRange] = useState({
    startIndex: 0,
    endIndex: 10
  });

  // 每頁拼接狀態,避免單靠 index 判斷邊界抖動
  const renderedPagesRef = useRef<Set<number>>(new Set());
  // 已預抓過的頁碼,避免重複 new Image()
  const prefetchedPagesRef = useRef<Set<number>>(new Set());
  // 這個 session 已顯示過追蹤提示,避免重複彈
  const trackMsgShownRef = useRef(false);
  // 這一話還沒等過第一頁渲染,避免 images 變動就重跑
  const initialLoadPendingRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 跳頁中暫停 range→progress 回寫,避免蓋掉目標頁進度
  const isJumpingRef = useRef(false);
  const jumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearJumpTimeout = useCallback(() => {
    if (jumpTimeoutRef.current) {
      clearTimeout(jumpTimeoutRef.current);
      jumpTimeoutRef.current = null;
    }
  }, []);
  const endScrollJump = useCallback(() => {
    isJumpingRef.current = false;
    clearJumpTimeout();
  }, [clearJumpTimeout]);

  // 大跳躍時顯示 Loading,等目標頁渲染完才關
  const [isPageJumping, setIsPageJumping] = useState(false);
  const jumpTargetPageRef = useRef<number | null>(null);
  const pageJumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endPageJump = useCallback(() => {
    jumpTargetPageRef.current = null;
    if (pageJumpTimeoutRef.current) {
      clearTimeout(pageJumpTimeoutRef.current);
      pageJumpTimeoutRef.current = null;
    }
    setIsPageJumping(false);
  }, []);
  useEffect(() => {
    setSizeCache({});
    setRenderRange({
      startIndex: 0,
      endIndex: 10
    });
    renderedPagesRef.current = new Set();
    prefetchedPagesRef.current = new Set();
    trackMsgShownRef.current = false;
    initialLoadPendingRef.current = true;
  }, [readId, queryId]);

  // 等第一頁真的 render 完成才關 Loading
  useEffect(() => {
    if (!initialLoadPendingRef.current || images.length === 0) return;
    initialLoadPendingRef.current = false;
    jumpTargetPageRef.current = images[0].page;
    setIsPageJumping(true);
    if (pageJumpTimeoutRef.current) clearTimeout(pageJumpTimeoutRef.current);
    pageJumpTimeoutRef.current = setTimeout(endPageJump, 5000);
  }, [images, endPageJump]);

  // 卸載時清掉 timer,避免卸載後 setState
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (jumpTimeoutRef.current) clearTimeout(jumpTimeoutRef.current);
      if (pageJumpTimeoutRef.current) clearTimeout(pageJumpTimeoutRef.current);
    };
  }, []);
  const handleSizeKnown = useCallback((page: number, w: number, h: number) => {
    setSizeCache(prev => ({
      ...prev,
      [page]: w / h
    }));
  }, []);

  // 穩定 callback,避免 ScrambleComicPage 的 memo 失效
  const handleRenderStateChange = useCallback((page: number, rendered: boolean) => {
    if (rendered) {
      renderedPagesRef.current.add(page);
      if (page === jumpTargetPageRef.current) endPageJump();
    } else {
      renderedPagesRef.current.delete(page);
    }
  }, [endPageJump]);
  const handleRangeChanged = useCallback((range: {
    startIndex: number;
    endIndex: number;
  }) => {
    // renderRange 不防抖,避免快速滾動時空白
    setRenderRange(range);

    // 進度條數字維持防抖
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (isJumpingRef.current) return; // 跳頁中交給 scrollToProgress

      // 接近底部交給 handleWindowScroll,避免兩邊打架
      if (isVertical && images.length > 0) {
        const distanceFromBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
        if (distanceFromBottom <= 1) return;
        if (window.scrollY <= 0) {
          setScrollProgress(1);
        } else {
          setScrollProgress(range.startIndex + 1);
        }
      }
    }, DEBOUNCE_MS);
  }, [isVertical, images.length, BOTTOM_RANGE]);

  // Keep the first and last image synchronized with the window scroll edges.
  useEffect(() => {
    if (!isVertical) return;
    const handleWindowScroll = () => {
      if (window.scrollY <= 0) {
        setScrollProgress(1);
        return;
      }
      const distanceFromBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (distanceFromBottom <= 1) setScrollProgress(Math.max(1, images.length));
    };
    window.addEventListener("scroll", handleWindowScroll, {
      passive: true
    });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [isVertical, images.length, BOTTOM_RANGE]);
  usePrefetchImages(images, renderRange, PREFETCH_AHEAD, prefetchedPagesRef);
  useEffect(() => {
    const isNative = Capacitor.getPlatform() === "android";
    if (isNative) {
      const hasShownVolumeHint = localStorage.getItem("hasShownVolumeHint");
      if (!hasShownVolumeHint) {
        const timer = setTimeout(() => {
          showSnackbar("可使用音量鍵＋翻頁", "success");
          localStorage.setItem("hasShownVolumeHint", "true");
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, []);
  function usePrefetchImages(images: {
    page: number;
    image: string;
  }[], range: {
    startIndex: number;
    endIndex: number;
  }, aheadCount: number, prefetchedPagesRef: React.MutableRefObject<Set<number>>) {
    useEffect(() => {
      const from = Math.max(0, range.startIndex - aheadCount);
      const to = Math.min(images.length - 1, range.endIndex + aheadCount);
      for (let i = from; i <= to; i++) {
        const item = images[i];
        if (!item?.image || prefetchedPagesRef.current.has(item.page)) continue;
        prefetchedPagesRef.current.add(item.page);
        const img = new Image();
        img.src = item.image; // 預先下載進 HTTP cache,之後同 URL 直接命中
      }
    }, [range, images, aheadCount, prefetchedPagesRef]);
  }
  useEffect(() => {
    setScrollProgress(1);
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    dispatch(CLEAR_DETIAL_LIST("readList"));
    dispatch(RESET_FORUM_STATE());
    if (readId && queryId) {
      dispatch(FETCH_COMIC_READ_THUNK({
        id: readId,
        express: config.express
      }));
      // dispatch(FETCH_DETAIL_THUNK(queryId));
    }
  }, [readId, queryId, config.app_img_shunt]);

  // 切換直橫向只需要重置畫面位置，不重打 API
  useEffect(() => {
    setScrollProgress(1);
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    if (swiperRef.current?.swiper && !isVertical) {
      swiperRef.current.swiper.slideTo(0, 0);
    }
  }, [isVertical]);

  // Progress is the one-based image number; advertising is not part of pagination.
  const scrollToProgress = useCallback((progress: number) => {
    if (images.length === 0) return;
    if (progress <= 1) {
      isJumpingRef.current = true;
      clearJumpTimeout();
      jumpTimeoutRef.current = setTimeout(endScrollJump, 1500);
      if (isVertical) {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      } else {
        swiperRef.current?.swiper?.slideTo(0);
      }
      return;
    }
    const imageIndex = Math.min(progress - 1, images.length - 1);
    const currentIndex = isVertical ? renderRange.startIndex : swiperRef.current?.swiper?.activeIndex ?? 0;
    const isFarJump = Math.abs(imageIndex - currentIndex) > RENDER_RANGE;
    isJumpingRef.current = true;
    clearJumpTimeout();
    jumpTimeoutRef.current = setTimeout(endScrollJump, 1500);
    if (isFarJump) {
      // 等目標頁渲染完才關 Loading,不能只看捲動停止
      jumpTargetPageRef.current = images[imageIndex]?.page ?? null;
      setIsPageJumping(true);
      if (pageJumpTimeoutRef.current) clearTimeout(pageJumpTimeoutRef.current);
      pageJumpTimeoutRef.current = setTimeout(endPageJump, 5000);
    }
    if (isVertical) {
      // 太遠時 smooth 會邊捲邊修正而亂飄,改 auto 瞬跳
      virtuosoRef.current?.scrollToIndex({
        index: imageIndex,
        align: "start",
        behavior: isFarJump ? "auto" : "smooth"
      });
    } else {
      // Swiper 等寬沒有高度誤差,直接平滑過渡
      swiperRef.current?.swiper?.slideTo(imageIndex);
    }
  }, [images, isVertical, renderRange.startIndex, clearJumpTimeout, endScrollJump, endPageJump]);

  // 進度條點擊
  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    setScrollProgress(newValue as number);
    scrollToProgress(newValue as number);
  };

  // 橫向移動監聽
  const handleSwiperSlideChange = (swiper: SwiperClass) => {
    setScrollProgress(swiper.activeIndex + 1);
  };

  // 音量鍵改變進度條
  const scrollProgressRef = useRef(scrollProgress);
  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);
  useEffect(() => {
    if (isLoading) return;
    let lastTriggerTime = 0;
    const throttleTime = 150;
    function onVolumeKeyPressed(e: any) {
      const now = Date.now();
      if (now - lastTriggerTime < throttleTime) return;
      lastTriggerTime = now;
      const {
        direction
      } = e.detail || {};
      const prev = scrollProgressRef.current;
      let newProgress = prev;
      if (direction === "up") {
        newProgress = Math.max(1, prev - 1);
      } else if (direction === "down") {
        newProgress = Math.min(imageCount, prev + 1);
      }
      if (newProgress === prev) return;
      setScrollProgress(newProgress);
      scrollToProgress(newProgress);
    }
    window.addEventListener("volumeKeyPressed", onVolumeKeyPressed);
    return () => window.removeEventListener("volumeKeyPressed", onVolumeKeyPressed);
  }, [imageCount, isVertical, isLoading, scrollToProgress]);

  // 閱讀紀錄儲存
  useEffect(() => {
    localStorage.setItem("read", JSON.stringify(readHistory));
  }, [readHistory]);
  const handlerReadStorage = (comicId: string, chapterId: string) => {
    setReadHistory(prev => {
      const chapters = prev[comicId] || [];
      if (!chapters.includes(chapterId)) {
        return {
          ...prev,
          [comicId]: [...chapters, chapterId]
        };
      }
      return prev;
    });
  };

  // 章節按鍵顯示檢查
  useEffect(() => {
    const series = detailList.series;
    if (!series || series.length === 0) {
      setChangeCurrentPage({
        next: false,
        prev: false
      });
      return;
    }
    const currentItem = series.find((item: any) => item.id === readId);
    if (!currentItem) {
      setChangeCurrentPage({
        next: false,
        prev: false
      });
      return;
    }
    const sort = Number(currentItem.sort);
    const isFirstItem = sort === 1;
    const isLastItem = sort === series.length;
    setChangeCurrentPage({
      next: !isLastItem,
      prev: !isFirstItem
    });
  }, [readId, detailList.series]);

  // 最後一話最後一頁跳追蹤提示(3天內關過/顯示過就不跳)
  useEffect(() => {
    if (trackMsgShownRef.current) return;
    if (changeCurrentPage.next) return; // 還有下一話,不是最後一話
    if (images.length === 0) return;
    if (scrollProgress !== images.length) return;
    if (localStorage.getItem("dontShowExpiry")) return;
    trackMsgShownRef.current = true;
    setMsgOpen(prev => ({
      ...prev,
      readTrack: true
    }));
  }, [scrollProgress, images.length, changeCurrentPage.next]);

  // 下方左右切換章節
  const handlePageChange = (direction: "next" | "prev") => {
    closeExpress();
    setChangeCurrentPage({
      ...changeCurrentPage,
      next: true,
      prev: true
    });
    const {
      series
    } = detailList;
    if (series?.length > 0) {
      const currentIndex = series.findIndex((item: any) => item.id === readId);
      const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
      const targetItem = series[newIndex];
      if (targetItem) {
        const chunkIndex = seriesGroups.menus.findIndex((chunk: any) => chunk.some((item: any) => item.id === readId));
        setSeriesGroups((prev: any) => ({
          ...prev,
          subEpisode: targetItem.sort,
          currentChapterId: targetItem.id
        }));
        handlerReadStorage(queryId, targetItem.id);
        navigate(`/comic/detail/read?id=${queryId}&readId=${targetItem.id}&episode=${chunkIndex}&subEpisode=${targetItem.sort}`);
      }
    }
  };

  // Modal章節
  useEffect(() => {
    const chunkSize = 10;
    const {
      series
    } = detailList;
    if (series?.length > 0) {
      const chunkedSeries = [];
      for (let i = 0; i < series.length; i += chunkSize) {
        chunkedSeries.push(series.slice(i, i + chunkSize));
      }
      const chunkIndex = chunkedSeries.reverse().findIndex((chunk: any) => chunk.some((item: any) => item.id === readId));
      setSeriesGroups({
        ...seriesGroups,
        menus: chunkedSeries,
        episode: chunkIndex
      });
    }
  }, [detailList.series]);

  // 追蹤漫畫
  const handleTracking = async (id: string) => {
    if (!logined) {
      showSnackbar(t("login.please_login"), "error");
      setDialogOpen({
        ...dialogOpen,
        login: true
      });
    } else {
      const result = await dispatch(FETCH_POST_NOTIFICATIONS_SERTRACK_THUNK(id)).unwrap();
      const {
        code,
        data
      } = result;
      if (code === 200) {
        showSnackbar(data, "success");
      }
    }
  };

  // 三天不顯示視窗
  const handleSetDontShow = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      localStorage.setItem("dontShowExpiry", String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    } else {
      localStorage.removeItem("dontShowExpiry");
    }
  };

  // 快速通道
  useEffect(() => {
    if (setting?.is_cn === 1) {
      const d = [{
        title: t("modal.fast_track"),
        key: 0
      }, ...(setting.app_shunts || [])];
      setReadImgSource(d);
    } else {
      setReadImgSource(setting.app_shunts);
    }
  }, [setting?.is_cn]);
  const closeExpress = () => {
    if (config.express === "on") {
      sessionStorage.setItem("imageSource", "1");
      setConfig(prev => ({
        ...prev,
        express: "",
        app_img_shunt: "1"
      }));
    }
  };
  return <>
      {(isLoading || isPageJumping) && <Loading />}
      <div className="h-full bg-white text-white relative">
        <motion.div initial={{
        y: 0
      }} animate={{
        y: closeNav ? -200 : 0
      }} transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }} className={`fixed top-[calc(env(safe-area-inset-top)+0px)] w-full bg-nbk bg-opacity-90 flex flex-col z-40`}>
          <HeaderAds />
          <AnimatePresence>
            {!dialogOpen.comment && <motion.div initial={{
            y: 0
          }} animate={{
            y: !dialogOpen.comment ? 0 : -200
          }} transition={{
            type: "spring",
            stiffness: 300,
            damping: 30
          }} className="w-full flex justify-between items-center h-14 px-3 py-2">
                <GoBack back={`/comic/detail?id=${queryId || detailList.series_id}&readId=${readId}&episode=${seriesGroups.episode}&subEpisode=${seriesGroups.subEpisode}`} />
                <p className="truncate w-10/12">{readList.name}</p>
                <ShareIcon sx={{
              fontSize: 26,
              stroke: "white",
              strokeWidth: 1
            }} onClick={() => setShare(true)} />
              </motion.div>}
          </AnimatePresence>
        </motion.div>
        <div onClick={e => {
        e.preventDefault();
        setCloseNav(prev => !prev);
      }} className="pt-20 pb-40 flex h-full" ref={containerRef} style={{
        flexDirection: isVertical ? "column" : "row",
        // 垂直模式要 stretch:column + center 會讓子項寬度依內容決定,被原生尺寸撐開就狂閃
        alignItems: isVertical ? "stretch" : "center",
        // 垂直模式兩軸都 visible,讓 window 當唯一捲動來源
        overflowX: isVertical ? "visible" : "scroll",
        overflowY: isVertical ? "visible" : "hidden",
        scrollSnapType: isVertical ? undefined : "x mandatory"
      }}>
          {isVertical ? <>
              <></>
              <Virtuoso ref={virtuosoRef} useWindowScroll data={images} style={{
            width: "100%"
          }}
          // overscan 只往捲動方向延伸,往上捲會現掛現拼接才閃,改成兩邊都先掛好
          increaseViewportBy={{
            top: VIEWPORT_EXTRA_PX,
            bottom: VIEWPORT_EXTRA_PX
          }} rangeChanged={handleRangeChanged} isScrolling={scrolling => {
            if (!scrolling) endScrollJump();
          }} itemContent={(i, d) => {
            const distFromRange = i < renderRange.startIndex ? renderRange.startIndex - i : i > renderRange.endIndex ? i - renderRange.endIndex : 0;
            const alreadyRendered = renderedPagesRef.current.has(d.page);
            const shouldRender = alreadyRendered ? distFromRange <= KEEP_RANGE : distFromRange <= RENDER_RANGE;
            return <ScrambleComicPage key={d.page} page={d.page} image={d.image} aid={readList.id} scrambleId={readList.scramble_id} knownAspectRatio={sizeCache[d.page]} onSizeKnown={handleSizeKnown} shouldRender={shouldRender} onRenderStateChange={handleRenderStateChange} />;
          }} />
              <></>
              <></>
            </> : <>
              <Swiper modules={[Virtual]} virtual={{
            enabled: true,
            addSlidesBefore: 2,
            addSlidesAfter: 2
          }} initialSlide={0} className="mySwiper h-screen" onSlideChange={handleSwiperSlideChange} ref={swiperRef}>
                <></>
                {images.map((d: any, i: number) => <SwiperSlide key={d.image} virtualIndex={i}>
                    <ScrambleComicPage page={d.page} image={d.image} aid={readList.id} scrambleId={readList.scramble_id} knownAspectRatio={sizeCache[d.page]} onSizeKnown={handleSizeKnown} shouldRender={true} onRenderStateChange={handleRenderStateChange} />
                  </SwiperSlide>)}
                <></>
                <></>
              </Swiper>
            </>}
        </div>

        {dialogOpen.series && <div className={`w-full h-[90vh] sticky bottom-0 left-0 bg-white dark:bg-bbk z-50 overflow-y-auto transition-all duration-1000 ${dialogOpen.series ? "animate-move-up" : "animate-move-down"}`}>
            <div className="h-12 sticky top-0 bg-nbk flex items-center z-20">
              <CloseIcon sx={{
            fontSize: 24,
            stroke: "white",
            strokeWidth: 2,
            marginLeft: 2
          }} onClick={() => setDialogOpen({
            ...dialogOpen,
            series: false
          })} />
              <p className="ml-5 truncate w-9/12">{readList.name}</p>
            </div>
            <div className="w-11/12 m-auto">
              <Series t={t} episodeOnTop={true} queryId={queryId} detailList={detailList} seriesGroups={seriesGroups} setSeriesGroups={setSeriesGroups} msgOpen={msgOpen} handlerReadStorage={handlerReadStorage} readHistory={readHistory} setDialogOpen={setDialogOpen} closeExpress={closeExpress} />
            </div>
          </div>}
        {dialogOpen.comment && <div className={`w-full h-[90vh] sticky bottom-0 left-0 bg-[#ededed] z-30 overflow-y-auto transition-all duration-1000 ${dialogOpen.comment ? "animate-move-up" : "animate-move-down"}`}>
            <div className="h-12 sticky top-0 bg-nbk flex items-center z-20">
              <CloseIcon sx={{
            fontSize: 24,
            stroke: "white",
            strokeWidth: 2,
            marginLeft: 2
          }} onClick={() => setDialogOpen({
            ...dialogOpen,
            comment: false
          })} />
              <p className="ml-5 truncate w-9/12">{readList.name}</p>
            </div>
            <div className="w-full m-auto text-gy dark:text-tgy dark:bg-bbk">
              <div className="py-3 px-2"></div>
              <Comment t={t} bottomTopicInput={true} queryId={queryId} setting={setting} memberInfo={memberInfo} logined={logined} dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} showSnackbar={showSnackbar} />
            </div>
          </div>}
        <AnimatePresence>
          {!closeNav && <motion.button className="fixed left-4 bottom-40 bg-og rounded-full size-16 z-20" onClick={() => setDialogOpen({
          ...dialogOpen,
          readSource: true
        })} initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: 20
        }} transition={{
          duration: 0.3
        }} whileTap={{
          scale: 0.9
        }} whileHover={{
          scale: 1.05
        }}>
              <FlashOnIcon className="text-4xl" />
            </motion.button>}
        </AnimatePresence>
        <ReadNav readId={readId} logined={logined} isLoading={isLoading} setIsVertical={setIsVertical} isVertical={isVertical} changeCurrentPage={changeCurrentPage} handlePageChange={handlePageChange} scrollProgress={scrollProgress} imageCount={imageCount} handleSliderChange={handleSliderChange} setDialogOpen={setDialogOpen} dialogOpen={dialogOpen} readList={readList} detailList={detailList} showSnackbar={showSnackbar} closeNav={closeNav} />
      </div>
      {dialogOpen.readSource && <DialogModal readImgSource={readImgSource} setDialogOpen={setDialogOpen} dialogOpen={dialogOpen} />}
      {share && <Share share={share} setShare={setShare} setting={setting} queryId={readId} showSnackbar={showSnackbar} />}
      {(dialogOpen.login || dialogOpen.signUp || dialogOpen.forgot) && !logined && <MemberModal setFormData={setFormData} formData={formData} setConfig={setConfig} logined={logined} isLoading={isLoading} setDialogOpen={setDialogOpen} dialogOpen={dialogOpen} showSnackbar={showSnackbar} />}
      {msgOpen.readTrack && <MsgModal t={t} logined={logined} queryId={queryId} setMsgOpen={setMsgOpen} msgOpen={msgOpen} handleTracking={handleTracking} handleSetDontShow={handleSetDontShow} />}

      <PositionedSnackbar setSnackbars={setSnackbars} snackbars={snackbars} />
    </>;
};
export default Read;
const SPINNER_DELAY_MS = 250; // 拼接超過這個時間才顯示 loading
const SPINNER_MIN_MS = 400; // loading 最短顯示時間

// 掃全部而不是只看 nextElementSibling:img.after() 會把新 canvas 插在孤兒前面
function clearCanvases(img: HTMLImageElement) {
  let node = img.nextElementSibling;
  while (node) {
    const next = node.nextElementSibling;
    if (node instanceof HTMLCanvasElement) {
      node.getContext("2d")?.clearRect(0, 0, node.width, node.height);
      node.width = 0;
      node.height = 0;
      node.remove();
    }
    node = next;
  }
}
function waitForImageLoad(img: HTMLImageElement) {
  return new Promise<void>(resolve => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
    } else {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    }
  });
}
interface ScrambleComicPageProps {
  page: number;
  image: string;
  aid: string;
  scrambleId: string;
  knownAspectRatio?: number;
  onSizeKnown?: (page: number, width: number, height: number) => void;
  shouldRender: boolean;
  onRenderStateChange?: (page: number, rendered: boolean) => void;
}
const ScrambleComicPage = memo(function ScrambleComicPage({
  page,
  image,
  aid,
  scrambleId,
  knownAspectRatio,
  onSizeKnown,
  shouldRender,
  onRenderStateChange
}: ScrambleComicPageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const processedRef = useRef(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(knownAspectRatio ?? null);
  const [rendered, setRendered] = useState(false);
  // 延遲出現 + 最短顯示時間,避免秒拼完也閃一下 loading
  const [showSpinner, setShowSpinner] = useState(false);
  const spinnerStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (!rendered) {
      const timer = setTimeout(() => {
        spinnerStartRef.current = Date.now();
        setShowSpinner(true);
      }, SPINNER_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (!showSpinner) return;
    const elapsed = spinnerStartRef.current ? Date.now() - spinnerStartRef.current : SPINNER_MIN_MS;
    const remaining = Math.max(SPINNER_MIN_MS - elapsed, 0);
    const timer = setTimeout(() => setShowSpinner(false), remaining);
    return () => clearTimeout(timer);
  }, [rendered, showSpinner]);
  const destroyCanvas = () => {
    const img = imgRef.current;
    if (!img) return;
    clearCanvases(img);
    img.style.opacity = "0";
    processedRef.current = false;
    setRendered(false);
    onRenderStateChange?.(page, false);
  };
  const buildCanvas = async (isCancelled: () => boolean) => {
    const img = imgRef.current;
    if (!img || processedRef.current) return;
    await waitForImageLoad(img);
    if (isCancelled()) return;
    if (!knownAspectRatio && !aspectRatio) {
      const ratio = img.naturalWidth / img.naturalHeight;
      setAspectRatio(ratio);
      onSizeKnown?.(page, img.naturalWidth, img.naturalHeight);
    }
    const existingCanvas = img.nextElementSibling;
    if (existingCanvas instanceof HTMLCanvasElement) {
      processedRef.current = true;
      setRendered(true);
      onRenderStateChange?.(page, true);
      return;
    }
    const altKey = image?.match(/\/([^/]+)\.webp/)?.[1] ?? String(page);
    try {
      await scrambleLimiter.run(() => scramble_image(img, aid, scrambleId, altKey), isCancelled);
    } catch (err) {
      // 拼接失敗也要往下跑,不然跳頁 Loading 等不到 onRenderStateChange
      console.error("scramble_image failed:", err);
    }
    if (isCancelled()) {
      // 可能已經插了一張 canvas,取消也要收乾淨
      clearCanvases(img);
      return;
    }
    processedRef.current = true;
    const newCanvas = img.nextElementSibling;
    if (newCanvas instanceof HTMLCanvasElement) {
      newCanvas.style.position = "absolute";
      newCanvas.style.top = "0";
      newCanvas.style.left = "0";
      // 只給寬度,高度按自己的比例算(撐成 100% 會被外框的佔位比例拉長)
      newCanvas.style.width = "100%";
      // 淡入,出現時平滑一點
      newCanvas.style.opacity = "0";
      newCanvas.style.transition = "opacity 0.15s ease";
      requestAnimationFrame(() => {
        if (isCancelled()) return;
        newCanvas.style.opacity = "1";
      });
      setRendered(true);
      onRenderStateChange?.(page, true);
      return;
    }
    if (!newCanvas || img.src.endsWith(".gif")) {
      img.style.transition = "opacity 0.15s ease";
      img.style.opacity = "1";
      img.dataset.noScrambleMark = "noScramble";
      setRendered(true);
      onRenderStateChange?.(page, true);
    }
  };
  useEffect(() => {
    let cancelled = false;
    if (shouldRender) {
      buildCanvas(() => cancelled).catch(() => {});
    } else {
      destroyCanvas();
    }
    return () => {
      cancelled = true;
    };
  }, [shouldRender, image]);
  return <div className="w-full relative mt-[-2px]" style={{
    aspectRatio: aspectRatio ?? 0.7,
    // 未知尺寸先用常見比例佔位,減少跳動
    minHeight: 200 // 避免 width 量到 0 時高度變 0
  }}>
      <img ref={imgRef} src={image} alt={String(page)} width="100%" height="auto" className="w-full object-cover block" style={{
      opacity: 0
    }} draggable={false} onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()} />
      {showSpinner && <div className="absolute inset-0 flex items-center justify-center">
          <CircularProgress color="inherit" size={24} className="text-lgy" />
        </div>}
    </div>;
});
