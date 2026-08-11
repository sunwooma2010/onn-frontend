import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "./api/client";
import type { ScheduleResponse } from "./types/api";
import { BsMegaphoneFill } from "react-icons/bs";
import { FaCalendarAlt } from "react-icons/fa";
import { FaRegTrashCan } from "react-icons/fa6";
import { IoSettingsOutline } from "react-icons/io5";

const GOOGLE_CLIENT_ID =
  "540014946000-43qnhms27eobeqi3p9a04ttcacar6f43.apps.googleusercontent.com";
const REDIRECT_URI = "http://localhost:5173/auth/callback";
const ADMIN_EMAIL =
  "1221jyp@gmail.com,jiyul100515@gmail.com,seoy3742@gmail.com,sunwooma2010@gmail.com,hyanghee0624@gmail.com";

interface NoticeItem {
  id: string;
  category: "주요공지" | "행사안내" | "일반";
  title: string;
  content: string;
  date: string;
}

interface UserInfo {
  email: string;
  name?: string;
}

const CLASS_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const NOTICE_CATEGORY_TO_ENUM: Record<
  "주요공지" | "행사안내" | "일반",
  string
> = {
  주요공지: "IMPORTANT",
  행사안내: "EVENTS",
  일반: "GENERAL",
};

const ENUM_TO_NOTICE_CATEGORY: Record<
  string,
  "주요공지" | "행사안내" | "일반"
> = {
  IMPORTANT: "주요공지",
  EVENTS: "행사안내",
  GENERAL: "일반",
};

export default function App() {
  const formatISOToLocal = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
  };

  const getTodayFormattedDate = (): string => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTarget, setSelectedTarget] = useState("전체 학급");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [openGrade, setOpenGrade] = useState<number | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<"schedule" | "notice">("schedule");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newGrade, setNewGrade] = useState(0);
  const [newClassNum, setNewClassNum] = useState(0);
  const [targetScheduleDate, setTargetScheduleDate] = useState(new Date());
  const [adminCalMonth, setAdminCalMonth] = useState(new Date());
  const [noticeCategory, setNoticeCategory] = useState<
    "주요공지" | "행사안내" | "일반"
  >("주요공지");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [grade, setGrade] = useState<number>(0);
  const [classNum, setClassNum] = useState<number>(0);

  const closeAdminModal = () => {
    setNewTitle("");
    setNewContent("");
    setNoticeTitle("");
    setNoticeContent("");
    setNewGrade(0);
    setNewClassNum(0);
    setTargetScheduleDate(new Date());
    setAdminCalMonth(new Date());
    setAdminTab("schedule");
    setIsAdminOpen(false);
  };

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const res = await api.get<string>("/me");
        if (res.data) {
          setUser({ email: res.data });
        }
      } catch (err) {
        setUser(null);
      }
    };
    checkLoginStatus();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");

    if (authCode) {
      window.history.replaceState({}, document.title, window.location.pathname);

      api
        .post("/token", {
          auth_code: authCode,
          redirect_uri: REDIRECT_URI,
        })
        .then(async () => {
          try {
            const meRes = await api.get<string>("/me");
            if (meRes.data) {
              setUser({ email: meRes.data });
            }
          } catch (err) {
            console.error("사용자 정보 조회 실패:", err);
          }
        })
        .catch((err) => {
          if (!(err.response && err.response.status === 401)) {
            console.warn("로그인 실패:", err.message);
            alert("로그인 중 오류가 발생했습니다.");
          }
        });
    }
  }, []);

  useEffect(() => {
    api
      .get("/posts")
      .then((res) => {
        if (Array.isArray(res.data)) {
          const formattedNotices: NoticeItem[] = res.data.map((item: any) => {
            const formattedDate = item.createdAt
              ? String(item.createdAt).split("T")[0].replace(/-/g, ".")
              : "";

            return {
              id: String(item.id),
              category: ENUM_TO_NOTICE_CATEGORY[item.category] || "일반",
              title: item.title,
              content: item.content,
              date: formattedDate,
            };
          });

          setNotices(formattedNotices);
        }
      })
      .catch((err) => console.error("공지사항 로딩 실패:", err));
  }, []);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const gradeClassCombos: { grade: number; classNum: number }[] = [];
      for (const g of [1, 2, 3]) {
        for (const c of CLASS_NUMBERS) {
          gradeClassCombos.push({ grade: g, classNum: c });
        }
      }

      const [commonRes, ...restResList] = await Promise.all([
        api.get<ScheduleResponse[]>("/schedules"), // 전체 공통
        ...[1, 2, 3].map((g) =>
          api.get<ScheduleResponse[]>("/schedules", { params: { grade: g } }),
        ), // 학년 전체(반 없음)
        ...gradeClassCombos.map(({ grade: g, classNum: c }) =>
          api.get<ScheduleResponse[]>("/schedules", {
            params: { grade: g, classNum: c },
          }),
        ),
      ]);

      const merged = [
        ...commonRes.data,
        ...restResList.flatMap((res) => res.data),
      ];

      const uniqueSchedules = Array.from(
        new Map(merged.map((item) => [item.id, item])).values(),
      );

      setSchedules(uniqueSchedules);
    } catch (err) {
      console.error("일정 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleGoogleLogin = () => {
    const scope =
      "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI,
    )}&scope=${encodeURIComponent(scope)}`;

    window.location.href = authUrl;
  };

  const handleLogout = () => {
    api
      .delete("/token")
      .catch((err) => {
        console.error("로그아웃 요청 실패:", err);
      })
      .finally(() => {
        setUser(null);
        setIsAdminOpen(false);
        alert("로그아웃 되었습니다.");
      });
  };

  const isAdmin = useMemo(() => {
    if (!user || !ADMIN_EMAIL.trim()) return false;
    const adminList = ADMIN_EMAIL.split(",").map((e) => e.trim());
    return adminList.includes(user.email);
  }, [user]);

  const handleGradeChange = (gradeVal: number) => {
    setNewGrade(gradeVal);
    if (gradeVal === 0) setNewClassNum(0);
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const parsedGrade = Number(newGrade);
    const parsedClassNum = Number(newClassNum);

    const requestBody = {
      title: newTitle,
      content: newContent,
      grade: parsedGrade === 0 ? null : parsedGrade,
      classNum:
        parsedGrade === 0 || parsedClassNum === 0 ? null : parsedClassNum,
      endDate: formatISOToLocal(targetScheduleDate),
    };

    try {
      const response = await api.post("/schedules", requestBody);
      if (response.status === 201 || response.status === 200) {
        await fetchSchedules();
        closeAdminModal();
        alert("새 일정이 성공적으로 등록되었습니다.");
      }
    } catch (err: any) {
      console.error("일정 등록 실패:", err);
      if (err.response?.status === 401) {
        alert("로그인 세션이 만료되었거나 권한이 없습니다 (401 Unauthorized).");
      } else if (err.response?.status === 403) {
        alert("관리자 권한이 필요하거나 CSRF 토큰 검증에 실패했습니다.");
      } else {
        alert("일정 등록 도중 오류가 발생했습니다.");
      }
    }
  };

  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim()) return;

    const now = new Date();
    const currentDateStr = getTodayFormattedDate();

    const requestBody = {
      title: noticeTitle,
      content: noticeContent,
      category: NOTICE_CATEGORY_TO_ENUM[noticeCategory],
      date: formatISOToLocal(now),
    };

    try {
      const response = await api.post("/posts", requestBody);
      if (response.status === 201 || response.status === 200) {
        alert("새 공지사항이 성공적으로 게시되었습니다.");
        const rawCategory = response.data?.category ?? requestBody.category;
        const rawDate = response.data?.createdAt ?? requestBody.date;

        const newNoticeItem: NoticeItem = {
          id: String(response.data?.id || Date.now()),
          category: ENUM_TO_NOTICE_CATEGORY[rawCategory] || noticeCategory,
          title: noticeTitle,
          content: noticeContent,
          date: rawDate
            ? String(rawDate).split("T")[0].replace(/-/g, ".")
            : currentDateStr.replace(/-/g, "."),
        };
        setNotices((prev) => [newNoticeItem, ...prev]);
        closeAdminModal();
      }
    } catch (err: any) {
      console.error("공지사항 등록 실패:", err);
      if (err.response?.status === 400) {
        alert(
          "요청 형식이 올바르지 않습니다 (400 Bad Request). 카테고리 값 등을 확인해주세요.",
        );
      } else if (err.response?.status === 401) {
        alert("로그인 세션이 만료되었거나 권한이 없습니다 (401).");
      } else if (err.response?.status === 403) {
        alert("관리자 권한이 필요합니다.");
      } else if (err.response?.status === 500) {
        alert(
          "서버 내부 오류(500)가 발생했습니다. 날짜 형식 등 요청 데이터를 다시 확인해주세요.",
        );
      } else {
        alert("공지사항 등록 도중 오류가 발생했습니다.");
      }
    }
  };

  const handleDeleteNotice = async (postId: string) => {
    if (!confirm("정말 이 공지사항을 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/posts?postId=${postId}`);
      alert("공지사항이 삭제되었습니다.");
      setNotices((prev) => prev.filter((item) => item.id !== postId));
    } catch (err) {
      console.error("공지사항 삭제 실패:", err);
      alert("공지사항 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("정말 이 일정을 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/schedules/${scheduleId}`);
      alert("일정이 성공적으로 삭제되었습니다.");
      setSchedules((prev) => prev.filter((item) => item.id !== scheduleId));
    } catch (err: any) {
      console.error("일정 삭제 실패:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        alert("삭제 권한이 없거나 관리자 로그인 세션이 만료되었습니다.");
      } else {
        alert("일정 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const adminYear = adminCalMonth.getFullYear();
  const adminMonth = adminCalMonth.getMonth();
  const adminFirstDay = new Date(adminYear, adminMonth, 1).getDay();
  const adminLastDate = new Date(adminYear, adminMonth + 1, 0).getDate();
  const getScheduleRank = (item: ScheduleResponse): number => {
    if (!item.grade || item.grade === 0) return 0;
    if (!item.classNum || item.classNum === 0) return 1;
    return 2;
  };

  const filteredSchedules = useMemo(() => {
    if (!selectedDate) return [];
    return schedules
      .filter((item) => {
        const itemDate = new Date(item.endDate);
        const isSameDate =
          itemDate.getFullYear() === selectedDate.getFullYear() &&
          itemDate.getMonth() === selectedDate.getMonth() &&
          itemDate.getDate() === selectedDate.getDate();

        if (!isSameDate) return false;

        if (grade === 0) return true;
        if (item.grade === null || item.grade === 0) return true;
        if (item.grade === grade) {
          if (classNum === 0) return true;
          return (
            item.classNum === null ||
            item.classNum === 0 ||
            item.classNum === classNum
          );
        }

        return false;
      })
      .sort((a, b) => getScheduleRank(a) - getScheduleRank(b));
  }, [schedules, selectedDate, grade, classNum]);

  return (
    <div
      style={{ backgroundColor: "#131314" }}
      className="w-[360px] h-[100vh] flex flex-col relative overflow-hidden shadow-2xl text-[#e3e2e6] select-none"
    >
      <div className="px-4 pt-4 pb-1 z-10">
        <div
          onClick={() => setIsNoticeModalOpen(true)}
          style={{ backgroundColor: "#1e1f20", borderColor: "#37393b" }}
          className="border rounded-2xl p-3 flex items-center justify-between shadow-lg relative overflow-hidden cursor-pointer hover:bg-[#282a2c] active:scale-[0.98] transition-all duration-200"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-500"></div>
          <div className="flex items-center space-x-3 pl-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
              <span className="text-yellow-500 text-sm">
                <BsMegaphoneFill />
              </span>
            </div>
            <div className="overflow-hidden text-left">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-bold text-yellow-500 uppercase">
                  공지사항
                </span>
                <span className="text-[9px] text-[#9aa0a6]">
                  {notices[0]?.date || ""}
                </span>
              </div>
              <p className="text-xs text-[#e3e2e6] font-medium truncate">
                {notices[0] ? notices[0].title : "등록된 공지사항이 없습니다."}
              </p>
            </div>
          </div>
          <span className="text-xs text-[#9aa0a6]">▶</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center relative z-30 px-4 py-1">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          style={{
            backgroundColor: isFilterOpen ? "#282a2c" : "transparent",
          }}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-[#282a2c] active:scale-[0.97]"
        >
          <h1 className="text-sm font-bold text-white flex items-center gap-2">
            <span>오남고등학교 일정표</span>
            <span
              style={{
                backgroundColor: "rgba(168, 199, 250, 0.15)",
                color: "#a8c7fa",
              }}
              className="text-xs px-2 py-0.5 rounded-full"
            >
              {selectedTarget}
            </span>
          </h1>
          <span className="text-xs text-[#9aa0a6]">
            {isFilterOpen ? "▲" : "▼"}
          </span>
        </button>

        {isFilterOpen && (
          <div
            style={{ backgroundColor: "#1e1f20", borderColor: "#37393b" }}
            className="absolute top-10 border rounded-2xl shadow-2xl py-2 w-64 z-40 max-h-[350px] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div
              style={{ borderColor: "#37393b" }}
              className="px-3 py-1.5 text-[11px] font-semibold text-[#9aa0a6] border-b text-left"
            >
              대상 학년 및 학반 선택
            </div>

            <button
              onClick={() => {
                setGrade(0);
                setClassNum(0);
                setSelectedTarget("전체 학급");
                setIsFilterOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#a8c7fa] font-medium hover:bg-[#282a2c] transition-colors flex justify-between items-center"
            >
              <span>전체 학급</span>
              {selectedTarget === "전체 학급" && <span>✓</span>}
            </button>

            {[1, 2, 3].map((g) => (
              <div
                key={g}
                style={{ borderColor: "rgba(55, 57, 59, 0.5)" }}
                className="border-t"
              >
                <div className="flex items-center justify-between px-4 py-2 hover:bg-[#282a2c] transition-colors">
                  <button
                    onClick={() => {
                      setGrade(g);
                      setClassNum(0);
                      setSelectedTarget(`${g}학년 전체`);
                      setIsFilterOpen(false);
                    }}
                    className="text-sm font-medium text-[#e3e2e6] text-left flex-1"
                  >
                    {g}학년 전체 학급
                  </button>
                  <button
                    onClick={() => setOpenGrade(openGrade === g ? null : g)}
                    className="text-xs text-[#9aa0a6] px-2 py-1 hover:text-white"
                  >
                    {openGrade === g ? "▲" : "▼"}
                  </button>
                </div>

                {openGrade === g && (
                  <div
                    style={{ borderColor: "#37393b" }}
                    className="bg-black/40 px-3 py-2 grid grid-cols-3 gap-1.5 border-y animate-in fade-in duration-150"
                  >
                    {CLASS_NUMBERS.map((cNum) => (
                      <button
                        key={cNum}
                        onClick={() => {
                          setGrade(g);
                          setClassNum(cNum);
                          setSelectedTarget(`${g}학년 ${cNum}반`);
                          setIsFilterOpen(false);
                        }}
                        style={{
                          backgroundColor: "#1e1f20",
                          borderColor: "#37393b",
                        }}
                        className="py-1 px-2 text-xs text-[#e3e2e6] hover:bg-[#282a2c] active:scale-[0.95] rounded-lg border text-center transition-all"
                      >
                        {cNum}반
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 no-scrollbar pb-20">
        <div
          style={{ backgroundColor: "#1e1f20", borderColor: "#37393b" }}
          className="border rounded-3xl p-4 shadow-xl"
        >
          <div className="flex items-center justify-between mb-3 px-2">
            <button
              onClick={() => {
                setCurrentDate(new Date(year, month - 1, 1));
                setSelectedDate(null);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#9aa0a6] hover:text-white hover:bg-white/10 active:bg-white/20 active:scale-90 transition-all duration-150"
            >
              ◀
            </button>
            <span className="text-sm font-bold text-white">
              {year}년 {month + 1}월
            </span>
            <button
              onClick={() => {
                setCurrentDate(new Date(year, month + 1, 1));
                setSelectedDate(null);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#9aa0a6] hover:text-white hover:bg-white/10 active:bg-white/20 active:scale-90 transition-all duration-150"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#9aa0a6] mb-2">
            <div className="text-red-400">일</div>
            <div>월</div>
            <div>화</div>
            <div>수</div>
            <div>목</div>
            <div>금</div>
            <div className="text-blue-400">토</div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium content-start min-h-[236px]">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}
            {Array.from({ length: lastDate }).map((_, i) => {
              const day = i + 1;
              const isSelected =
                selectedDate !== null &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(new Date(year, month, day))}
                  className={`h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90 ${
                    isSelected
                      ? "bg-[#a8c7fa] text-[#131314] font-bold"
                      : "bg-transparent text-[#e3e2e6] font-normal hover:bg-white/10 active:bg-white/20"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div
              style={{ backgroundColor: "#1e1f20", borderColor: "#37393b" }}
              className="border rounded-2xl p-4 text-center animate-pulse"
            >
              <p className="text-xs text-[#9aa0a6]">
                일정을 불러오는 중입니다...
              </p>
            </div>
          ) : selectedDate ? (
            <>
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-bold text-[#9aa0a6]">
                  {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일
                  일정
                </h3>
                <span
                  style={{
                    backgroundColor: "rgba(168, 199, 250, 0.15)",
                    color: "#a8c7fa",
                  }}
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                >
                  {filteredSchedules.length}개 일정
                </span>
              </div>

              {filteredSchedules.length === 0 ? (
                <div
                  style={{ backgroundColor: "#1e1f20", borderColor: "#37393b" }}
                  className="border rounded-2xl p-4 text-center"
                >
                  <p className="text-xs text-[#9aa0a6]">
                    등록된 학사 일정이 없습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSchedules.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: "#1e1f20",
                        borderColor: "#37393b",
                      }}
                      className="border rounded-2xl p-3.5 text-left space-y-1 hover:border-[#a8c7fa]/50 transition-colors duration-200 relative group"
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-white pr-6">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                            {!item.grade || item.grade === 0
                              ? "전체"
                              : item.classNum
                                ? `${item.grade}학년 ${item.classNum}반`
                                : `${item.grade}학년 전체`}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() =>
                                handleDeleteSchedule(String(item.id))
                              }
                              className="text-xs text-red-400 hover:text-red-300 transition-colors p-1"
                              title="일정 삭제"
                            >
                              <FaRegTrashCan />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[#9aa0a6]">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div
              style={{ backgroundColor: "#1e1f20", borderColor: "#37393b" }}
              className="border rounded-2xl p-4 flex flex-row items-center justify-center gap-2"
            >
              <FaCalendarAlt className="text-xs text-[#9aa0a6]" />
              <span className="text-xs text-[#9aa0a6]">
                달력에서 날짜를 선택하면 일정을 볼 수 있습니다.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-20">
        <div>
          {isAdmin && (
            <button
              onClick={() => setIsAdminOpen(true)}
              style={{
                backgroundColor: "#1e1f20",
                borderColor: "#37393b",
                color: "#a8c7fa",
              }}
              className="border hover:bg-[#282a2c] active:scale-[0.95] transition-all duration-150 px-3.5 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5"
            >
              <span className="flex items-center">
                <IoSettingsOutline />
                <span className="pl-1"> 관리자 탭</span>
              </span>
            </button>
          )}
        </div>

        {user ? (
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: "#282a2c",
              borderColor: "#37393b",
              color: "#e3e2e6",
            }}
            className="border px-3.5 py-2 rounded-full text-xs font-bold shadow-lg hover:bg-[#37393b] active:scale-[0.95] transition-all duration-150"
          >
            로그아웃
          </button>
        ) : (
          <button
            onClick={handleGoogleLogin}
            style={{
              backgroundColor: "rgba(168, 199, 250, 0.15)",
              borderColor: "rgba(168, 199, 250, 0.3)",
              color: "#a8c7fa",
            }}
            className="border px-3.5 py-2 rounded-full text-xs font-bold shadow-lg hover:bg-[#a8c7fa]/20 active:scale-[0.95] transition-all duration-150 flex items-center gap-1.5"
          >
            <span>구글 로그인</span>
          </button>
        )}
      </div>

      {isNoticeModalOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center animate-in fade-in duration-200">
          <div
            style={{ backgroundColor: "#1e1f20", borderColor: "#37393b" }}
            className="border-b w-full rounded-b-3xl p-5 space-y-3 text-left max-h-[85%] flex flex-col animate-in slide-in-from-top duration-300 shadow-2xl"
          >
            <div
              style={{ borderColor: "#37393b" }}
              className="flex justify-between items-center border-b pb-2"
            >
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>
                  <BsMegaphoneFill />
                </span>
                학교 공지사항 목록
              </h3>
              <button
                onClick={() => setIsNoticeModalOpen(false)}
                className="text-[#9aa0a6] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 no-scrollbar pr-0.5">
              {notices.map((n) => (
                <div
                  key={n.id}
                  style={{ backgroundColor: "#131314", borderColor: "#37393b" }}
                  className="border rounded-2xl p-3 space-y-1 hover:border-[#a8c7fa]/40 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">
                      {n.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#9aa0a6]">
                        {n.date}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteNotice(n.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors p-0.5"
                          title="공지사항 삭제"
                        >
                          <FaRegTrashCan />
                        </button>
                      )}
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-white">{n.title}</h4>
                  <p className="text-xs text-[#9aa0a6] leading-relaxed">
                    {n.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAdmin && isAdminOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center animate-in fade-in duration-200">
          <div
            style={{ backgroundColor: "#1e1f20", borderColor: "#37393b" }}
            className="border-t w-full rounded-t-3xl p-5 space-y-3 text-left max-h-[92%] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300"
          >
            <div
              style={{ borderColor: "#37393b" }}
              className="flex justify-between items-center border-b pb-2"
            >
              <div className="flex space-x-2">
                <button
                  onClick={() => setAdminTab("schedule")}
                  style={{
                    backgroundColor:
                      adminTab === "schedule" ? "#a8c7fa" : "#282a2c",
                    color: adminTab === "schedule" ? "#131314" : "#9aa0a6",
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.95]"
                >
                  <span className="flex items-center">
                    <FaCalendarAlt />
                    <span className="pl-1">일정 등록</span>
                  </span>
                </button>
                <button
                  onClick={() => setAdminTab("notice")}
                  style={{
                    backgroundColor:
                      adminTab === "notice" ? "#a8c7fa" : "#282a2c",
                    color: adminTab === "notice" ? "#131314" : "#9aa0a6",
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.95]"
                >
                  <span className="flex items-center">
                    <BsMegaphoneFill />
                    <span className="pl-1">전체 공지 등록</span>
                  </span>
                </button>
              </div>
              <button
                onClick={closeAdminModal}
                className="text-[#9aa0a6] hover:text-white font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {adminTab === "schedule" && (
              <form onSubmit={handleAddSchedule} className="space-y-3 text-xs">
                <div>
                  <label className="text-[#9aa0a6] block mb-1">일정 제목</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="일정 제목을 입력하세요"
                    style={{
                      backgroundColor: "#131314",
                      borderColor: "#37393b",
                      color: "#fff",
                    }}
                    className="w-full border rounded-xl p-2 focus:outline-none focus:border-[#a8c7fa] transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="text-[#9aa0a6] block mb-1">상세 내용</label>
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="상세 내용을 입력하세요"
                    style={{
                      backgroundColor: "#131314",
                      borderColor: "#37393b",
                      color: "#fff",
                    }}
                    className="w-full border rounded-xl p-2 h-14 resize-none focus:outline-none focus:border-[#a8c7fa] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#9aa0a6] block mb-1">
                      대상 학년
                    </label>
                    <select
                      value={newGrade}
                      onChange={(e) =>
                        handleGradeChange(Number(e.target.value))
                      }
                      style={{
                        backgroundColor: "#131314",
                        borderColor: "#37393b",
                        color: "#fff",
                      }}
                      className="w-full border rounded-xl p-2 focus:outline-none focus:border-[#a8c7fa] transition-colors"
                    >
                      <option value={0}>전체 학년</option>
                      <option value={1}>1학년</option>
                      <option value={2}>2학년</option>
                      <option value={3}>3학년</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#9aa0a6] block mb-1">대상 반</label>
                    <select
                      value={newClassNum}
                      disabled={newGrade === 0}
                      onChange={(e) => setNewClassNum(Number(e.target.value))}
                      style={{
                        backgroundColor: newGrade === 0 ? "#1e1f20" : "#131314",
                        borderColor: "#37393b",
                        color: newGrade === 0 ? "#666" : "#fff",
                        cursor: newGrade === 0 ? "not-allowed" : "pointer",
                      }}
                      className="w-full border rounded-xl p-2 transition-colors focus:outline-none focus:border-[#a8c7fa]"
                    >
                      <option value={0}>전체 반</option>
                      {CLASS_NUMBERS.map((c) => (
                        <option key={c} value={c}>
                          {c}반
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  style={{ backgroundColor: "#131314", borderColor: "#37393b" }}
                  className="border rounded-2xl p-3 space-y-2"
                >
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[#9aa0a6] font-semibold">
                      일정 날짜 선택:{" "}
                      <strong className="text-[#a8c7fa]">
                        {targetScheduleDate.getFullYear()}년{" "}
                        {targetScheduleDate.getMonth() + 1}월{" "}
                        {targetScheduleDate.getDate()}일
                      </strong>
                    </span>
                    <div className="space-x-1">
                      <button
                        type="button"
                        onClick={() =>
                          setAdminCalMonth(
                            new Date(adminYear, adminMonth - 1, 1),
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-[#282a2c] text-[#9aa0a6] hover:text-white transition-colors"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAdminCalMonth(
                            new Date(adminYear, adminMonth + 1, 1),
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-[#282a2c] text-[#9aa0a6] hover:text-white transition-colors"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#9aa0a6]">
                    <div className="text-red-400">일</div>
                    <div>월</div>
                    <div>화</div>
                    <div>수</div>
                    <div>목</div>
                    <div>금</div>
                    <div className="text-blue-400">토</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs content-start min-h-[188px]">
                    {Array.from({ length: adminFirstDay }).map((_, i) => (
                      <div key={`admin-empty-${i}`} className="h-7" />
                    ))}
                    {Array.from({ length: adminLastDate }).map((_, i) => {
                      const d = i + 1;
                      const isSel =
                        targetScheduleDate.getDate() === d &&
                        targetScheduleDate.getMonth() === adminMonth &&
                        targetScheduleDate.getFullYear() === adminYear;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setTargetScheduleDate(
                              new Date(adminYear, adminMonth, d),
                            )
                          }
                          style={{
                            backgroundColor: isSel ? "#a8c7fa" : "transparent",
                            color: isSel ? "#131314" : "#e3e2e6",
                            fontWeight: isSel ? "bold" : "normal",
                          }}
                          className="h-7 rounded-lg flex items-center justify-center transition-all duration-150 hover:bg-white/10 active:bg-white/20 active:scale-90"
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  style={{ backgroundColor: "#a8c7fa", color: "#131314" }}
                  className="w-full py-2.5 font-bold rounded-xl mt-2 hover:opacity-90 active:scale-[0.99] transition-all"
                >
                  새 일정 등록하기
                </button>
              </form>
            )}

            {adminTab === "notice" && (
              <form onSubmit={handleAddNotice} className="space-y-3 text-xs">
                <div>
                  <label className="text-[#9aa0a6] block mb-1">
                    공지 카테고리
                  </label>
                  <select
                    value={noticeCategory}
                    onChange={(e) =>
                      setNoticeCategory(
                        e.target.value as "주요공지" | "행사안내" | "일반",
                      )
                    }
                    style={{
                      backgroundColor: "#131314",
                      borderColor: "#37393b",
                      color: "#fff",
                    }}
                    className="w-full border rounded-xl p-2 focus:outline-none focus:border-[#a8c7fa] transition-colors"
                  >
                    <option value="주요공지">주요공지</option>
                    <option value="행사안내">행사안내</option>
                    <option value="일반">일반</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#9aa0a6] block mb-1">공지 제목</label>
                  <input
                    type="text"
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    placeholder="공지 제목을 입력하세요"
                    style={{
                      backgroundColor: "#131314",
                      borderColor: "#37393b",
                      color: "#fff",
                    }}
                    className="w-full border rounded-xl p-2 focus:outline-none focus:border-[#a8c7fa] transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="text-[#9aa0a6] block mb-1">
                    공지 상세 내용
                  </label>
                  <textarea
                    value={noticeContent}
                    onChange={(e) => setNoticeContent(e.target.value)}
                    placeholder="공지할 상세 내용을 입력하세요"
                    style={{
                      backgroundColor: "#131314",
                      borderColor: "#37393b",
                      color: "#fff",
                    }}
                    className="w-full border rounded-xl p-2 h-28 resize-none focus:outline-none focus:border-[#a8c7fa] transition-colors"
                    required
                  />
                </div>

                <button
                  type="submit"
                  style={{ backgroundColor: "#a8c7fa", color: "#131314" }}
                  className="w-full py-2.5 font-bold rounded-xl mt-2 hover:opacity-90 active:scale-[0.99] transition-all"
                >
                  전체 공지 게시하기
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
