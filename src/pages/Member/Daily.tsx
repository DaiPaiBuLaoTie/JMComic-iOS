import classNames from "classnames";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { FETCH_DAILY_CHECK_THUNK, FETCH_DAILY_LIST_FILTER_THUNK, FETCH_GET_DAILY_THUNK } from "../../actions/memberAction";
import PositionedSnackbar, { useSnackbarState } from "../../components/Alert/PositionedSnackbar";
import Loading from "../../components/Common/Loading";
import BottomNav from "../../components/Main/BottomNav";
import DialogModal from "../../components/Modal/DialogModal";
import MemberModal from "../../components/Modal/MemberModal";
import { useGlobalConfig } from "../../GlobalContext";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { defaultUserFormData } from "../../utils/InterFace";
const Daily = () => {
  const {
    config,
    setConfig
  } = useGlobalConfig();
  const {
    setting,
    logined
  } = config;
  const navigate = useNavigate();
  const location = useLocation();
  const {
    t
  } = useTranslation();
  const {
    snackbars,
    setSnackbars,
    showSnackbar
  } = useSnackbarState();
  const memberInfo = JSON.parse(localStorage.getItem("memberInfo") as string);
  const dispatch = useAppDispatch();
  const {
    dailyList,
    memberResult,
    isLoading
  } = useAppSelector(state => state.member);
  const month = (new Date().getMonth() + 1).toString();
  const todayDate = new Date().getDate();
  const [check, setCheck] = useState(true);
  const [formData, setFormData] = useState(defaultUserFormData);
  const [dialogOpen, setDialogOpen] = useState({
    login: false,
    signUp: false,
    forgot: false,
    watchAds: false
  });
  const [makeupMode, setMakeupMode] = useState(false); // 看完廣告後，允許使用者從月曆挑一天補簽
  const [pendingMakeupDate, setPendingMakeupDate] = useState<string | null>(null); // 已點選、正在等待送出的補簽日期

  // 後端 dailyList.makeup_used 目前永遠回 0，改用 localStorage 自行記錄本月已補簽次數
  const now = new Date();
  const makeupUsedStorageKey = `makeup_used_${memberInfo?.uid}_${now.getFullYear()}-${now.getMonth() + 1}`;
  const [makeupUsedLocal, setMakeupUsedLocal] = useState(() => {
    return Number(localStorage.getItem(makeupUsedStorageKey) ?? 0);
  });
  useEffect(() => {
    if (logined && memberInfo) {
      const msg = memberResult.data?.msg ?? "";
      if (!msg.includes("已經簽到過了")) {
        dispatch(FETCH_GET_DAILY_THUNK(memberInfo?.uid));
      }
    }
  }, [logined, memberResult]);
  const allSigned = dailyList.record?.length > 0 && dailyList.record.every((week: any) => week.every((day: any) => day.signed === true));
  const makeupUsed = makeupUsedLocal;
  const makeupLimit = dailyList.makeup_limit ?? 5;
  // 本月是否還有「今天以前、尚未簽到」的日期可補；沒有的話看完廣告也選不到任何一天
  const hasMakeupCandidates = dailyList.record?.length > 0 && dailyList.record.some((week: any) => week.some((day: any) => day.signed !== true && Number(day.date) < todayDate));
  const makeupAvailable = makeupUsed < makeupLimit && hasMakeupCandidates;
  const handleCheckEvent = async () => {
    const result = await dispatch(FETCH_DAILY_CHECK_THUNK({
      user_id: memberInfo.uid,
      daily_id: dailyList.daily_id
    })).unwrap();
    const {
      msg
    } = result.data;
    const type = msg.includes("已經簽到過了") ? "error" : "success";
    showSnackbar(msg, type);
  };

  // 已購買去廣告的會員不用看廣告，直接進入補簽模式，補簽次數上限仍受 makeupLimit 限制
  const adFreeStatus = memberInfo?.ad_free === true;
  const handleMakeupButtonClick = () => {
    if (!makeupAvailable) return;
    setMakeupMode(true);
  };

  // DialogModal 的 watchAds 廣告關閉後才會呼叫 (強制看滿 5 秒才能關閉)
  const handleWatchAdsClosed = () => {
    setMakeupMode(true);
  };

  // 使用者放棄這次補簽機會，不扣額度
  const handleCancelMakeupMode = () => {
    setMakeupMode(false);
  };

  // dailyList.record 裡的 date 只是當月的「日」(例如 "5")，補簽 API 需要完整 YYYY-MM-DD
  const toFullDate = (day: string) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const handleMakeupCheckEvent = async (day: string) => {
    const result = await dispatch(FETCH_DAILY_CHECK_THUNK({
      user_id: memberInfo.uid,
      daily_id: dailyList.daily_id,
      date: toFullDate(day)
    })).unwrap();
    const {
      msg
    } = result.data;
    const success = msg.includes("補簽成功");
    const type = success ? "success" : "error";
    showSnackbar(msg, type);
    if (success) {
      const nextUsed = makeupUsedLocal + 1;
      setMakeupUsedLocal(nextUsed);
      localStorage.setItem(makeupUsedStorageKey, String(nextUsed));
    }
  };

  // 點選日期先亮 1 秒給使用者確認感，再送出補簽請求；期間鎖住其他日期避免重複點擊
  const handleSelectMakeupDate = (date: string) => {
    if (pendingMakeupDate) return;
    setPendingMakeupDate(date);
    setTimeout(() => {
      setMakeupMode(false);
      handleMakeupCheckEvent(date);
      setPendingMakeupDate(null);
    }, 1000);
  };
  const handleFullCheckEvent = async () => {
    const result = await dispatch(FETCH_DAILY_LIST_FILTER_THUNK(month)).unwrap();
    const {
      msg,
      status
    } = result.data;
    const type = status !== "ok" ? "error" : "success";
    if (result.code === 200) {
      showSnackbar(msg, type);
      setCheck(false);
    }
  };
  const styled = {
    date: {
      class: "w-[25px] h-[25px] border-2 border-dashed border-[#bbb] bg-[#ebebeb] p-1 rounded-[8px] text-[#bbb] flex justify-center items-center",
      style: {}
    },
    done: {
      class: "w-[25px] h-[25px] border-2 border-dashed border-[#943234] rounded-[8px] p-1 bg-[#943234] bg-cover bg-center bg-no-repeat flex justify-center items-center shadow-md shadow-stone-500/50",
      style: {
        backgroundImage: `url('/images/signList/done-icon.png')`
      }
    },
    heart: {
      class: "w-[25px] h-[25px] border-2 border-dashed border-[#f23f57] rounded-[8px] p-1 bg-[#fab3b1] bg-cover bg-center bg-no-repeat flex justify-center items-center shadow-md shadow-stone-500/50",
      style: {
        backgroundImage: `url('/images/signList/event-heart.png')`
      }
    },
    sign: {
      class: "w-[25px] h-[25px] border-2 border-solid border-gy bg-[#ffffff] rounded-[8px] p-1 text-gy flex justify-center items-center shadow-md shadow-stone-500/50",
      style: {}
    },
    signed: {
      class: "w-[25px] h-[25px] border-2 border-dashed border-[#943234] rounded-[8px] p-1 bg-[#943234] bg-cover bg-center bg-no-repeat  flex justify-center items-center shadow-md shadow-stone-500/50",
      style: {
        backgroundImage: `url('/images/signList/event-heart.png')`
      }
    }
  };
  return <>
      {isLoading && <Loading />}
      <div className="w-full min-h-screen bg-cover bg-center overflow-hidden flex justify-center items-center" style={{
      backgroundImage: dailyList.background_phone ? `url(${setting?.img_host + dailyList.background_phone})` : `url(images/chapter_default.jpg)`
    }}>
        <div className="w-10/12 border border-solid border-bbk rounded text-center">
          <div className="relative bg-og border border-solid border-bbk text-white p-4 z-20">
            <div className="absolute top-[-15px] left-0 w-full flex justify-around">
              <img src="/images/signList/coil.png" alt="coil1" width="15px" height="15px" />
              <img src="/images/signList/coil.png" alt="coil2" width="15px" height="15px" />
            </div>
            <div className="absolute top-[-4px] left-[14px]">
              <img src="/images/signList/month-badge.png" alt="month-badge" width="48px" height="48px" className="relative" />
              <p className="absolute left-1/2 top-1/2 transform -translate-y-1/2 -translate-x-1/2 text-sm">{month}月</p>
            </div>
            <p className="text-lg pt-2">{dailyList.event_name}</p>
          </div>
          <div className="relative border border-solid border-bbk p-6 bg-white z-10">
            <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-full h-full bg-center bg-no-repeat opacity-50" style={{
            backgroundImage: `url('/images/signList/main-bg.png')`,
            backgroundSize: `${logined ? "80%" : "40%"}`
          }} />
            {makeupMode && <div className="relative bg-og text-white text-sm rounded-lg py-2 px-3 mb-3 flex justify-between items-center">
                <span>{t("daily.select_makeup_date")}</span>
                <button className="underline ml-2 shrink-0" onClick={handleCancelMakeupMode}>
                  {t("comic.close")}
                </button>
              </div>}
            <ul className="grid grid-cols-7 gap-3 relative text-white">
              {dailyList.record?.length > 0 && dailyList.record.map((d: any) => d.map((item: any) => {
              const {
                signed,
                bonus,
                date
              } = item;
              let itemClass = "";
              let itemStyle = {};
              if (signed === null && bonus) {
                itemClass = styled.heart.class;
                itemStyle = styled.heart.style;
              } else if (signed && !bonus) {
                itemClass = styled.done.class;
                itemStyle = styled.done.style;
              } else if (signed === null && !bonus) {
                itemClass = styled.sign.class;
                itemStyle = styled.sign.style;
              } else if (!signed && signed !== null) {
                itemClass = styled.date.class;
                itemStyle = styled.date.style;
              } else if (signed && bonus) {
                itemClass = styled.signed.class;
                itemStyle = styled.signed.style;
              }
              const isPending = pendingMakeupDate === date;
              // 今天/未來/已簽到都不能補簽；已經點了別天等待送出時，暫時鎖住整個月曆
              const selectable = makeupMode && !pendingMakeupDate && signed !== true && Number(date) < todayDate;
              return <li key={date} className={classNames(isPending ? "w-[25px] h-[25px] rounded-[8px] p-1 bg-og text-white flex justify-center items-center scale-110 transition-transform" : itemClass, {
                "cursor-pointer ring-2 ring-offset-1 ring-og animate-pulse": selectable,
                "opacity-30": makeupMode && !selectable && !isPending
              })} style={isPending ? {} : itemStyle} onClick={() => selectable && handleSelectMakeupDate(date)}>
                        {date}
                      </li>;
            }))}
            </ul>
            <div className="relative flex justify-between items-center mt-4">
              <span className="">{t("daily.consecutive_check_in")}</span>
              <div className="w-9/12">
                <div className="flex text-end px-2">
                  <span className="w-1/2">3天</span>
                  <span className="w-1/2">7天</span>
                </div>
                <div className="w-full bg-white border-2 border-solid border-bbk opacity-100 rounded-full h-4">
                  <div className="bg-og h-full rounded-full" style={{
                  width: `${dailyList.currentProgress}`
                }}></div>
                </div>
                <div className="flex-col items-center px-2">
                  <div className="flex mt-1">
                    <p className="w-1/2 flex justify-end items-center">
                      <span>+{dailyList.three_days_coin}</span>
                      <img src="/images/coin.png" alt="" width="15px" height="15px" className="ml-2" />
                    </p>
                    <p className="w-1/2 flex justify-end items-center">
                      <span>+{dailyList.seven_days_coin}</span>
                      <img src="/images/coin.png" alt="" width="15px" height="15px" className="ml-2" />
                    </p>
                  </div>
                  <div className="flex mt-1">
                    <p className="w-1/2 flex justify-end items-center">
                      <span>+{dailyList.three_days_exp}</span>
                      <span>exp</span>
                    </p>
                    <p className="w-1/2 flex justify-end items-center">
                      <span>+{dailyList.seven_days_exp}</span>
                      <span>exp</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative text-white">
              <div className="grid grid-cols-2 gap-3 mt-2">
                {!logined ? <button className="bg-og rounded-lg py-2" onClick={() => setDialogOpen({
                ...dialogOpen,
                login: true
              })}>
                    {t("login.login")}
                  </button> : <button className="bg-og rounded-lg py-2" onClick={() => check && handleCheckEvent()}>
                    {t("daily.check_in_now")}
                  </button>}
                <button className="bg-gy rounded-lg py-2" onClick={() => navigate(location.state?.from || "/")}>
                  {t("comic.close")}
                </button>
                <button className={`rounded-lg py-2 ${makeupAvailable ? "bg-og" : "bg-[#ebebeb] text-[#bbb]"}`} disabled={!makeupAvailable} onClick={handleMakeupButtonClick}>
                  {t("daily.makeup_check_in_count", {
                  used: makeupUsed,
                  limit: makeupLimit
                })}
                </button>
                <button className={`rounded-lg py-2 border-2 border-dashed border-[#bbb] ${allSigned ? "bg-gy" : "bg-[#ebebeb] text-[#bbb]"}`} onClick={() => allSigned && handleFullCheckEvent()}>
                  {t("daily.full_check_in_reward")}
                </button>
              </div>
              <p className="text-red-600 mt-3">{t("daily.monthly_check_in_bonus")}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-16">
        <BottomNav currentPage="main" />
      </div>
      {(dialogOpen.login || dialogOpen.signUp || dialogOpen.forgot) && !logined && <MemberModal setFormData={setFormData} formData={formData} setConfig={setConfig} logined={logined} isLoading={isLoading} setDialogOpen={setDialogOpen} dialogOpen={dialogOpen} showSnackbar={showSnackbar} />}
      <DialogModal adKey="app_resigning" dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} watchAdsCloseDelay={5000} onWatchAdsClose={handleWatchAdsClosed} />
      <PositionedSnackbar setSnackbars={setSnackbars} snackbars={snackbars} />
    </>;
};
export default Daily;
